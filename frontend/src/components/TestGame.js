import React, { useState } from 'react';
import socketService from '../services/socket';
import './TestGame.css';

function TestGame() {
  const [gameCode, setGameCode] = useState('TEST01');
  const [username, setUsername] = useState('테스트학생');
  const [role, setRole] = useState('student');
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState('waiting');
  const [participants, setParticipants] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [questionResults, setQuestionResults] = useState([]);

  const handleConnect = () => {
    try {
      const socket = socketService.connect();
      if (socket) {
        setIsConnected(true);
        console.log('✅ 테스트용 소켓 연결됨');
      }
    } catch (error) {
      console.error('❌ 소켓 연결 실패:', error);
    }
  };

  const handleJoinGame = () => {
    try {
      socketService.joinGame(gameCode, username, role);
      console.log(`🎮 테스트 게임 참여: ${gameCode}, ${username}, ${role}`);
    } catch (error) {
      console.error('❌ 게임 참여 실패:', error);
    }
  };

  const handleStartGame = () => {
    try {
      // 테스트용 퀴즈 데이터
      const testQuiz = {
        title: '테스트 퀴즈',
        description: '테스트용 퀴즈입니다.',
        questions: [
          {
            question: '1 + 1은 무엇일까요?',
            options: ['1', '2', '3', '4'],
            correctAnswer: 1, // 0부터 시작하므로 1은 두 번째 옵션
            timeLimit: 30
          },
          {
            question: '한국의 수도는?',
            options: ['부산', '대구', '서울', '인천'],
            correctAnswer: 2, // 0부터 시작하므로 2는 세 번째 옵션
            timeLimit: 30
          },
          {
            question: '파이(π)의 값은?',
            options: ['3.14', '3.15', '3.16', '3.17'],
            correctAnswer: 0, // 0부터 시작하므로 0은 첫 번째 옵션
            timeLimit: 30
          }
        ]
      };

      console.log('📚 테스트 퀴즈 데이터:', testQuiz);
      console.log('📝 문제 1 정답:', testQuiz.questions[0].correctAnswer, '->', testQuiz.questions[0].options[testQuiz.questions[0].correctAnswer]);
      console.log('📝 문제 2 정답:', testQuiz.questions[1].correctAnswer, '->', testQuiz.questions[1].options[testQuiz.questions[1].correctAnswer]);
      console.log('📝 문제 3 정답:', testQuiz.questions[2].correctAnswer, '->', testQuiz.questions[2].options[testQuiz.questions[2].correctAnswer]);

      socketService.loadQuiz(gameCode, testQuiz);
      setTimeout(() => {
        socketService.startGame(gameCode);
      }, 1000);
    } catch (error) {
      console.error('❌ 게임 시작 실패:', error);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer !== null && !hasAnswered) {
      const timeSpent = currentQuestion.timeLimit - timeLeft;
      console.log('📝 테스트 답변 제출:', {
        selectedAnswer,
        selectedAnswerType: typeof selectedAnswer,
        correctAnswer: currentQuestion.correctAnswer,
        correctAnswerType: typeof currentQuestion.correctAnswer,
        isCorrect: selectedAnswer === currentQuestion.correctAnswer,
        timeSpent,
        timeLeft,
        timeLimit: currentQuestion.timeLimit
      });
      
      try {
        // 숫자 타입으로 확실히 변환
        const answerIndex = parseInt(selectedAnswer);
        socketService.submitAnswer(gameCode, answerIndex, timeSpent);
        setHasAnswered(true);
        console.log('✅ 테스트 답변 제출 완료');
      } catch (error) {
        console.error('❌ 테스트 답변 제출 실패:', error);
      }
    } else {
      console.log('❌ 테스트 답변 제출 조건 불만족:', {
        selectedAnswer,
        hasAnswered,
        currentQuestion: !!currentQuestion
      });
    }
  };

  // 소켓 이벤트 리스너
  React.useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('participantJoined', (data) => {
      setParticipants(data.participants || []);
      setGameState(data.gameState || 'waiting');
    });

    socket.on('gameStarted', (data) => {
      setGameState('playing');
      console.log('🎮 게임 시작됨:', data);
    });

    socket.on('questionDisplayed', (data) => {
      setCurrentQuestion(data.question);
      setTimeLeft(data.question.timeLimit);
      setSelectedAnswer(null);
      setHasAnswered(false);
      console.log('📝 문제 표시됨:', data);
    });

    socket.on('timerUpdate', (data) => {
      setTimeLeft(data.timeLeft);
    });

    socket.on('questionEnded', (data) => {
      setQuestionResults(data.results || []);
      setGameState('showing_results');
      console.log('⏰ 문제 종료:', data);
    });

    socket.on('gameEnded', (data) => {
      setGameState('ended');
      console.log('🏁 게임 종료:', data);
    });

    socket.on('leaderboardUpdate', (data) => {
      setLeaderboard(data.leaderboard);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('participantJoined');
      socket.off('gameStarted');
      socket.off('questionDisplayed');
      socket.off('timerUpdate');
      socket.off('questionEnded');
      socket.off('gameEnded');
      socket.off('leaderboardUpdate');
    };
  }, []);

  return (
    <div className="test-game">
      <div className="test-header">
        <h1>🎮 게임 플레이 테스트</h1>
        <p>실시간 퀴즈 게임 기능을 테스트해보세요.</p>
      </div>

      <div className="test-controls">
        <div className="control-group">
          <h3>연결 상태</h3>
          <div className="status-indicator">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? '연결됨' : '연결 안됨'}
          </div>
          <button onClick={handleConnect} disabled={isConnected}>
            연결
          </button>
        </div>

        <div className="control-group">
          <h3>게임 설정</h3>
          <div className="input-group">
            <label>게임 코드:</label>
            <input
              type="text"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          </div>
          <div className="input-group">
            <label>사용자명:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>역할:</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">학생</option>
              <option value="teacher">교사</option>
            </select>
          </div>
          <button onClick={handleJoinGame} disabled={!isConnected}>
            게임 참여
          </button>
        </div>

        {role === 'teacher' && (
          <div className="control-group">
            <h3>교사 컨트롤</h3>
            <button onClick={handleStartGame} disabled={!isConnected}>
              게임 시작
            </button>
          </div>
        )}
      </div>

      <div className="test-status">
        <div className="status-card">
          <h3>게임 상태</h3>
          <p>상태: {gameState}</p>
          <p>참가자: {participants.length}명</p>
          {currentQuestion && (
            <p>현재 문제: {currentQuestion.question}</p>
          )}
          {timeLeft > 0 && (
            <p>남은 시간: {timeLeft}초</p>
          )}
        </div>

        <div className="status-card">
          <h3>참가자 목록</h3>
          <div className="participants-list">
            {participants.map((participant, index) => (
              <div key={index} className="participant-item">
                <span>{participant.username}</span>
                <span className="role-badge">{participant.role}</span>
              </div>
            ))}
          </div>
        </div>

        {leaderboard.length > 0 && (
          <div className="status-card">
            <h3>리더보드</h3>
            <div className="leaderboard-list">
              {leaderboard.map((player, index) => (
                <div key={index} className="leaderboard-item">
                  <span>{index + 1}</span>
                  <span>{player.username}</span>
                  <span>{player.score}점</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {gameState === 'playing' && currentQuestion && (
        <div className="test-question">
          <h3>문제</h3>
          <p className="question-text">{currentQuestion.question}</p>
          <div className="options-list">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                className={`option-btn ${selectedAnswer === index ? 'selected' : ''}`}
                onClick={() => setSelectedAnswer(index)}
                disabled={hasAnswered}
              >
                {String.fromCharCode(65 + index)}. {option}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedAnswer === null || hasAnswered}
            className="submit-btn"
          >
            {hasAnswered ? '답변 제출됨' : '답변 제출'}
          </button>
        </div>
      )}

      {gameState === 'showing_results' && (
        <div className="test-results">
          <h3>문제 결과</h3>
          <div className="results-list">
            {questionResults.map((result, index) => (
              <div key={index} className={`result-item ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                <span>{result.username}</span>
                <span>{result.isCorrect ? '✅' : '❌'}</span>
                <span>+{result.score}점</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TestGame; 