const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// Middleware
app.use(cors());
app.use(express.json());

// Socket.io 연결 관리
const connectedUsers = new Map();
const activeGames = new Map();

// 게임 상태 상수
const GAME_STATES = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  SHOWING_RESULTS: 'showing_results',
  ENDED: 'ended'
};

// 점수 계산 함수
const calculateScore = (isCorrect, timeSpent, timeLimit) => {
  if (!isCorrect) return 0;
  const baseScore = 100;
  const timeBonus = Math.max(0, timeLimit - timeSpent) * 2;
  return baseScore + timeBonus;
};

io.on('connection', (socket) => {
  console.log('✅ 사용자가 연결되었습니다:', socket.id);
  console.log('📍 클라이언트 IP:', socket.handshake.address);
  console.log('📍 User-Agent:', socket.handshake.headers['user-agent']);
  
  // 연결 상태 확인
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // 사용자 입장
  socket.on('joinGame', (data) => {
    const { gameCode, username, role } = data;
    
    console.log(`🎮 게임 참여 요청 - 게임코드: ${gameCode}, 사용자: ${username}, 역할: ${role}`);
    
    // 게임 코드 검증
    if (!gameCode || !username) {
      console.log(`❌ 잘못된 참여 요청 - 게임코드: ${gameCode}, 사용자: ${username}`);
      socket.emit('gameError', { message: '게임 코드와 사용자명을 입력해주세요.' });
      return;
    }
    
    // 게임 코드 형식 검증 (6자리 대문자)
    if (!/^[A-Z0-9]{6}$/.test(gameCode)) {
      console.log(`❌ 잘못된 게임 코드 형식: ${gameCode}`);
      socket.emit('gameError', { message: '올바른 게임 코드를 입력해주세요.' });
      return;
    }
    

    
    socket.join(gameCode);
    connectedUsers.set(socket.id, { username, role, gameCode });
    
    // 게임에 참가자 추가
    if (!activeGames.has(gameCode)) {
      activeGames.set(gameCode, {
        participants: [],
        currentQuestion: null,
        gameState: GAME_STATES.WAITING,
        currentQuestionIndex: 0,
        questions: [],
        leaderboard: [],
        answers: new Map(),
        questionResults: new Map(),
        gameStartTime: null,
        currentQuestionStartTime: null
      });
    }
    
    const game = activeGames.get(gameCode);
    // 중복 참가자 제거
    game.participants = game.participants.filter(p => p.username !== username);
    
    // 고유한 참가자 ID 생성
    const participantId = `${socket.id}-${username}-${Date.now()}`;
    game.participants.push({
      id: participantId,
      socketId: socket.id,
      username,
      role,
      score: 0
    });
    
    // 새로 참가한 사용자에게 현재 게임 상태 전송
    socket.emit('gameStateSync', {
      gameState: game.gameState,
      currentQuestion: game.currentQuestion,
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: game.questions.length,
      timeLeft: game.currentQuestion ? game.currentQuestion.timeLimit : 0
    });
    
    // 모든 참가자에게 참가자 목록 전송
    const participantData = {
      participants: game.participants,
      gameState: game.gameState
    };
    
    console.log(`📋 참가자 목록 전송 - 게임: ${gameCode}, 참가자 수: ${game.participants.length}`);
    io.to(gameCode).emit('participantJoined', participantData);
    
    // 학생이 참여한 경우 교사에게 특별 알림
    if (role === 'student') {
      const teacherParticipant = game.participants.find(p => p.role === 'teacher');
      if (teacherParticipant) {
        console.log(`🎓 학생 참여 알림 - 교사에게 전송: ${username}`);
        io.to(teacherParticipant.socketId).emit('studentJoined', {
          student: { username, role },
          allParticipants: game.participants,
          gameState: game.gameState
        });
      }
    }
    
    console.log(`${username}님이 게임 ${gameCode}에 참가했습니다. (현재 상태: ${game.gameState})`);
  });

  // 게임 시작 (교사만)
  socket.on('startGame', (data) => {
    const { gameCode } = data;
    const user = connectedUsers.get(socket.id);
    
    console.log(`🎮 게임 시작 요청 - 게임코드: ${gameCode}, 사용자: ${user?.username}, 역할: ${user?.role}`);
    
    if (user && user.role === 'teacher' && user.gameCode === gameCode) {
      const game = activeGames.get(gameCode);
      
      if (!game) {
        console.log(`❌ 게임 ${gameCode}를 찾을 수 없습니다.`);
        socket.emit('gameError', { message: '게임을 찾을 수 없습니다.' });
        return;
      }
      
      // 게임이 이미 진행 중인지 확인
      if (game.gameState === GAME_STATES.PLAYING) {
        console.log(`⚠️ 게임 ${gameCode}가 이미 진행 중입니다.`);
        socket.emit('gameError', { message: '게임이 이미 진행 중입니다.' });
        return;
      }
      
      if (game.questions.length > 0) {
        console.log(`🎮 게임 ${gameCode} 시작 - 교사: ${user.username}, 문제 수: ${game.questions.length}`);
        
        // 게임 상태 초기화
        game.gameState = GAME_STATES.PLAYING;
        game.currentQuestionIndex = 0;
        game.gameStartTime = Date.now();
        game.answers.clear();
        game.questionResults.clear();
        
        // 모든 참가자에게 게임 시작 알림
        io.to(gameCode).emit('gameStarted', { 
          gameState: GAME_STATES.PLAYING,
          totalQuestions: game.questions.length
        });
        
        console.log(`📢 게임 시작 이벤트 전송 완료 - 참가자 수: ${game.participants.length}`);
        
        // 잠시 대기 후 첫 번째 문제 시작
        setTimeout(() => {
          startNextQuestion(game, gameCode);
        }, 2000);
        
      } else {
        console.log(`❌ 게임 ${gameCode}에 문제가 없습니다.`);
        socket.emit('gameError', { message: '퀴즈에 문제가 없습니다.' });
      }
    } else {
      console.log(`❌ 게임 시작 권한 없음 - 사용자: ${user?.username}, 역할: ${user?.role}`);
      socket.emit('gameError', { message: '게임 시작 권한이 없습니다.' });
    }
  });

  // 다음 문제 시작 함수
  const startNextQuestion = (game, gameCode) => {
    if (game.currentQuestionIndex >= game.questions.length) {
      // 모든 문제 완료 - 게임 종료
      console.log(`🏁 모든 문제 완료 - 게임 ${gameCode} 종료`);
      endGame(game, gameCode);
      return;
    }

    const question = game.questions[game.currentQuestionIndex];
    game.currentQuestion = question;
    game.currentQuestionStartTime = Date.now();
    game.answers.clear();
    game.questionResults.clear();

    console.log(`📝 문제 ${game.currentQuestionIndex + 1} 시작: ${question.question}`);
    console.log(`📊 옵션: ${question.options.join(', ')}`);
    console.log(`✅ 정답: ${question.correctAnswer}`);

    // 문제 표시
    const questionData = {
      question: question,
      questionNumber: game.currentQuestionIndex + 1,
      totalQuestions: game.questions.length
    };
    
    console.log(`📢 문제 표시 이벤트 전송 - 게임: ${gameCode}, 참가자 수: ${game.participants.length}`);
    io.to(gameCode).emit('questionDisplayed', questionData);

    // 타이머 시작
    let timeLeft = question.timeLimit;
    console.log(`⏰ 타이머 시작 - ${timeLeft}초`);
    
    const timer = setInterval(() => {
      timeLeft--;
      io.to(gameCode).emit('timerUpdate', { timeLeft });
      
      if (timeLeft <= 0) {
        clearInterval(timer);
        console.log(`⏰ 타이머 종료 - 문제 ${game.currentQuestionIndex + 1}`);
        endCurrentQuestion(game, gameCode);
      }
    }, 1000);
  };

  // 현재 문제 종료
  const endCurrentQuestion = (game, gameCode) => {
    console.log(`⏰ 문제 ${game.currentQuestionIndex + 1} 시간 종료`);
    
    // 결과 계산 및 표시
    const results = calculateQuestionResults(game);
    io.to(gameCode).emit('questionEnded', { results });
    
    // 3초 후 다음 문제 또는 게임 종료
    setTimeout(() => {
      game.currentQuestionIndex++;
      if (game.currentQuestionIndex < game.questions.length) {
        startNextQuestion(game, gameCode);
      } else {
        endGame(game, gameCode);
      }
    }, 3000);
  };

  // 문제 결과 계산
  const calculateQuestionResults = (game) => {
    const results = [];
    const correctAnswerIndex = parseInt(game.currentQuestion.correctAnswer);
    
    console.log(`📊 문제 ${game.currentQuestionIndex + 1} 결과 계산:`);
    console.log(`   정답 인덱스: ${correctAnswerIndex} (타입: ${typeof correctAnswerIndex})`);
    console.log(`   정답 텍스트: ${game.currentQuestion.options[correctAnswerIndex]}`);
    console.log(`   총 답변 수: ${game.answers.size}`);
    
    game.participants.forEach(participant => {
      const answer = game.answers.get(participant.socketId);
      if (answer) {
        // 타입 변환을 통한 정확한 비교
        const selectedAnswer = parseInt(answer.answer);
        const isCorrect = selectedAnswer === correctAnswerIndex;
        const score = calculateScore(isCorrect, answer.timeSpent, game.currentQuestion.timeLimit);
        
        // 이미 점수가 계산되어 있으므로 중복 계산 방지
        // participant.score += score; // 이 부분은 submitAnswer에서 이미 처리됨
        
        console.log(`   ${participant.username}: 선택=${selectedAnswer} (타입: ${typeof selectedAnswer}), 정답=${correctAnswerIndex} (타입: ${typeof correctAnswerIndex}), 맞음=${isCorrect}, 점수=${score}`);
        
        results.push({
          username: participant.username,
          answer: selectedAnswer,
          selectedAnswerText: game.currentQuestion.options[selectedAnswer],
          correctAnswerText: game.currentQuestion.options[correctAnswerIndex],
          correctAnswerIndex: correctAnswerIndex,
          isCorrect: isCorrect,
          score: score,
          totalScore: participant.score
        });
      } else {
        console.log(`   ${participant.username}: 답변 없음`);
      }
    });

    // 리더보드 업데이트
    game.leaderboard = game.participants
      .filter(p => p.role === 'student')
      .sort((a, b) => b.score - a.score);

    console.log(`📊 최종 리더보드:`, game.leaderboard.map(p => `${p.username}: ${p.score}점`));

    return results;
  };

  // 게임 종료
  const endGame = (game, gameCode) => {
    console.log(`🏁 게임 ${gameCode} 종료`);
    game.gameState = GAME_STATES.ENDED;
    
    io.to(gameCode).emit('gameEnded', {
      results: game.leaderboard,
      finalScores: game.participants.map(p => ({
        username: p.username,
        role: p.role,
        score: p.score
      }))
    });
  };

  // 참여자 목록 요청 처리
  socket.on('requestParticipants', (data) => {
    const { gameCode } = data;
    const user = connectedUsers.get(socket.id);
    
    if (user && user.gameCode === gameCode) {
      const game = activeGames.get(gameCode);
      if (game) {
        console.log(`📋 참여자 목록 요청 - 게임: ${gameCode}, 요청자: ${user.username}`);
        
        const participantData = {
          participants: game.participants,
          gameState: game.gameState
        };
        
        console.log(`📋 참여자 목록 전송 - 게임: ${gameCode}, 참가자 수: ${game.participants.length}`);
        socket.emit('participantJoined', participantData);
      }
    }
  });

  // 게임 상태 동기화 요청 처리
  socket.on('requestGameState', (data) => {
    const { gameCode } = data;
    const user = connectedUsers.get(socket.id);
    
    if (user && user.gameCode === gameCode) {
      const game = activeGames.get(gameCode);
      if (game) {
        console.log(`🔄 게임 상태 동기화 요청 - 게임: ${gameCode}, 요청자: ${user.username}`);
        
        const gameStateData = {
          gameState: game.gameState,
          currentQuestion: game.currentQuestion,
          questionNumber: game.currentQuestionIndex + 1,
          totalQuestions: game.questions.length,
          timeLeft: game.currentQuestion ? game.currentQuestion.timeLimit : 0,
          participants: game.participants,
          leaderboard: game.leaderboard
        };
        
        socket.emit('gameStateSync', gameStateData);
      } else {
        // 게임이 없는 경우는 조용히 처리 (alert 표시하지 않음)
        console.log(`⚠️ 게임 ${gameCode}를 찾을 수 없음 - 요청자: ${user.username}`);
      }
    } else {
      // 권한이 없는 경우는 조용히 처리 (alert 표시하지 않음)
      console.log(`⚠️ 게임 상태 동기화 권한 없음 - 사용자: ${user?.username}, 게임: ${user?.gameCode}`);
    }
  });



  // 다음 문제로 (교사만)
  socket.on('nextQuestion', (data) => {
    const { gameCode } = data;
    const user = connectedUsers.get(socket.id);
    
    if (user && user.role === 'teacher' && user.gameCode === gameCode) {
      const game = activeGames.get(gameCode);
      if (game && game.questions.length > 0) {
        const question = game.questions[game.currentQuestionIndex];
        if (question) {
          game.currentQuestion = question;
          game.answers.clear();
          
          // 문제 표시
          io.to(gameCode).emit('questionDisplayed', {
            question: question,
            questionNumber: game.currentQuestionIndex + 1,
            totalQuestions: game.questions.length
          });
          
          // 타이머 시작
          let timeLeft = question.timeLimit;
          const timer = setInterval(() => {
            timeLeft--;
            io.to(gameCode).emit('timerUpdate', { timeLeft });
            
            if (timeLeft <= 0) {
              clearInterval(timer);
              // 문제 종료
              io.to(gameCode).emit('questionEnded', {});
              game.currentQuestionIndex++;
              
              // 다음 문제가 있으면 자동으로 진행
              if (game.currentQuestionIndex < game.questions.length) {
                setTimeout(() => {
                  socket.emit('nextQuestion', { gameCode });
                }, 3000);
              } else {
                // 게임 종료
                socket.emit('endGame', { gameCode });
              }
            }
          }, 1000);
        }
      }
    }
  });

  // 답변 제출
  socket.on('submitAnswer', (data) => {
    const { gameCode, answer, timeSpent } = data;
    const user = connectedUsers.get(socket.id);
    
    console.log(`📝 답변 제출 요청 - 게임: ${gameCode}, 사용자: ${user?.username}, 답변: ${answer} (타입: ${typeof answer}), 소요시간: ${timeSpent}초`);
    
    if (user && user.gameCode === gameCode) {
      const game = activeGames.get(gameCode);
      if (game && game.currentQuestion && game.gameState === GAME_STATES.PLAYING) {
        // 이미 답변을 제출했는지 확인
        if (game.answers.has(socket.id)) {
          console.log(`⚠️ ${user.username}님이 이미 답변을 제출했습니다.`);
          return;
        }
        
        const isCorrect = answer === game.currentQuestion.correctAnswer;
        
        // 답변 저장
        game.answers.set(socket.id, {
          answer: answer,
          timeSpent,
          username: user.username
        });
        
        console.log(`✅ ${user.username}님이 답변을 제출했습니다: ${answer}`);
        
        // 참가자 점수 업데이트
        const participant = game.participants.find(p => p.socketId === socket.id);
        if (participant) {
          const score = calculateScore(isCorrect, timeSpent, game.currentQuestion.timeLimit);
          participant.score += score;
          
          console.log(`💰 ${user.username}님 점수: +${score}점 (총 ${participant.score}점)`);
        }
        
        // 실시간 리더보드 업데이트
        updateLeaderboard(game, gameCode);
      } else {
        console.log(`❌ 답변 제출 실패 - 게임 상태: ${game?.gameState}, 현재 문제: ${!!game?.currentQuestion}`);
      }
    } else {
      console.log(`❌ 답변 제출 권한 없음 - 사용자: ${user?.username}, 게임: ${user?.gameCode}`);
    }
  });

  // 리더보드 업데이트 함수
  const updateLeaderboard = (game, gameCode) => {
    game.leaderboard = game.participants
      .filter(p => p.role === 'student')
      .sort((a, b) => b.score - a.score);
    
    io.to(gameCode).emit('leaderboardUpdate', {
      leaderboard: game.leaderboard
    });
  };

  // 게임 종료 (교사만)
  socket.on('endGame', (data) => {
    const { gameCode } = data;
    const user = connectedUsers.get(socket.id);
    
    if (user && user.role === 'teacher' && user.gameCode === gameCode) {
      const game = activeGames.get(gameCode);
      if (game) {
        console.log(`🏁 게임 ${gameCode} 종료 요청 - 교사: ${user.username}`);
        game.gameState = GAME_STATES.ENDED;
        
        // 모든 참가자에게 게임 종료 알림
        io.to(gameCode).emit('gameEnded', {
          results: game.leaderboard
        });
        
        // 참가자 목록도 함께 업데이트
        io.to(gameCode).emit('participantJoined', {
          participants: game.participants,
          gameState: GAME_STATES.ENDED
        });
        
        console.log(`게임 ${gameCode}가 종료되었습니다.`);
      }
    }
  });

  // 퀴즈 데이터 로드 (교사만)
  socket.on('loadQuiz', (data) => {
    const { gameCode, quizData } = data;
    const user = connectedUsers.get(socket.id);
    
    if (user && user.role === 'teacher' && user.gameCode === gameCode) {
      const game = activeGames.get(gameCode);
      if (game) {
        game.questions = quizData.questions || [];
        console.log(`📚 게임 ${gameCode}에 퀴즈 데이터가 로드되었습니다. 문제 수: ${game.questions.length}`);
        
        // 게임 상태를 대기 상태로 리셋
        game.gameState = GAME_STATES.WAITING;
        game.currentQuestionIndex = 0;
        game.currentQuestion = null;
        game.answers.clear();
        game.questionResults.clear();
      }
    }
  });

  // 퀴즈 데이터 설정 (교사만)
  socket.on('setQuizData', (data) => {
    const { gameCode, quizData } = data;
    const user = connectedUsers.get(socket.id);
    
    if (user && user.role === 'teacher' && user.gameCode === gameCode) {
      const game = activeGames.get(gameCode);
      if (game) {
        game.questions = quizData.questions || [];
        console.log(`📝 게임 ${gameCode}에 퀴즈 데이터가 설정되었습니다. 문제 수: ${game.questions.length}`);
      }
    }
  });

  // 연결 해제
  socket.on('disconnect', (reason) => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      const game = activeGames.get(user.gameCode);
      if (game) {
        // 참가자 목록에서 제거
        const participantIndex = game.participants.findIndex(p => p.socketId === socket.id);
        if (participantIndex !== -1) {
          const removedParticipant = game.participants[participantIndex];
          game.participants.splice(participantIndex, 1);
          
          console.log(`❌ ${removedParticipant.username}님이 게임을 떠났습니다.`);
          
          // 모든 참가자에게 참가자 목록 업데이트 전송
          io.to(user.gameCode).emit('participantLeft', {
            participants: game.participants,
            gameState: game.gameState
          });
        }
      }
      connectedUsers.delete(socket.id);
    }
    console.log('❌ 사용자가 연결을 해제했습니다:', socket.id);
    console.log('📍 해제 이유:', reason);
  });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ message: 'Kahoot! 스타일 퀴즈 서버가 실행 중입니다.' });
});

// 게임 상태 확인
app.get('/api/games/:gameCode', (req, res) => {
  const { gameCode } = req.params;
  const game = activeGames.get(gameCode);
  
  if (game) {
    res.json(game);
  } else {
    res.status(404).json({ error: '게임을 찾을 수 없습니다.' });
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`로컬 접속: http://localhost:${PORT}`);
  console.log(`네트워크 접속: http://[your-ip]:${PORT}`);
}); 