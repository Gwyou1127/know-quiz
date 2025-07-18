import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import socketService from '../services/socket';
import './GamePlayer.css';

function GamePlayer({ gameCode, onGameEnd }) {
  const { currentUser } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [gameState, setGameState] = useState('waiting');
  const [participants, setParticipants] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [questionResults, setQuestionResults] = useState([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    const socket = socketService.getSocket();

    // 게임 시작
    socket.on('gameStarted', (data) => {
      console.log('🎮 게임이 시작되었습니다!', data);
      setGameState('playing');
      setTotalQuestions(data.totalQuestions || 0);
      setHasAnswered(false);
      setSelectedAnswer(null);
      
      // 게임 시작 시 즉시 문제가 표시되지 않으면 로딩 상태로 설정
      if (!currentQuestion) {
        setCurrentQuestion(null);
      }
    });

    // 게임 상태 동기화
    socket.on('gameStateSync', (data) => {
      console.log('🔄 게임 상태 동기화:', data);
      setGameState(data.gameState);
      setTotalQuestions(data.totalQuestions || 0);
      
      if (data.currentQuestion) {
        console.log('📝 동기화된 문제:', data.currentQuestion);
        setCurrentQuestion(data.currentQuestion);
        setTimeLeft(data.timeLeft || 0);
        setQuestionNumber(data.questionNumber || 0);
        setGameState('playing');
        setHasAnswered(false);
        setSelectedAnswer(null);
      }
      
      if (data.participants) {
        setParticipants(data.participants);
      }
      
      if (data.leaderboard) {
        setLeaderboard(data.leaderboard);
      }
    });

    // 문제 표시
    socket.on('questionDisplayed', (data) => {
      console.log('📝 문제가 표시되었습니다:', data.questionNumber, data.question);
      setCurrentQuestion(data.question);
      setTimeLeft(data.question.timeLimit);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setQuestionNumber(data.questionNumber);
      setTotalQuestions(data.totalQuestions);
      setGameState('playing');
      setShowResults(false);
      setQuestionResults([]);
    });

    // 타이머 업데이트
    socket.on('timerUpdate', (data) => {
      setTimeLeft(data.timeLeft);
    });

    // 문제 종료
    socket.on('questionEnded', (data) => {
      console.log('⏰ 문제 종료, 결과 표시:', data.results);
      setGameState('showing_results');
      setQuestionResults(data.results || []);
      setShowResults(true);
      setTimeLeft(0);
      setHasAnswered(false);
      setSelectedAnswer(null);
    });

    // 게임 종료
    socket.on('gameEnded', (data) => {
      console.log('🏁 게임 종료:', data);
      setGameState('ended');
      setHasAnswered(false);
      setSelectedAnswer(null);
      if (onGameEnd) {
        onGameEnd(data.results);
      }
    });

    // 리더보드 업데이트
    socket.on('leaderboardUpdate', (data) => {
      setLeaderboard(data.leaderboard);
    });

    // 참가자 목록 업데이트
    socket.on('participantJoined', (data) => {
      setParticipants(data.participants || []);
    });

    // 참가자 퇴장
    socket.on('participantLeft', (data) => {
      setParticipants(data.participants || []);
    });

    // 에러 처리
    socket.on('gameError', (data) => {
      console.error('🚨 게임 에러:', data);
      // 연결 관련 에러는 alert 표시하지 않음
      if (data.message && !data.message.includes('연결') && !data.message.includes('권한')) {
        alert(data.message || '게임 중 오류가 발생했습니다.');
      }
    });

    // 컴포넌트 마운트 시 게임 상태 동기화 요청
    if (gameCode) {
      console.log('🔄 초기 게임 상태 동기화 요청');
      try {
        socketService.requestGameState(gameCode);
      } catch (error) {
        console.error('❌ 게임 상태 동기화 요청 실패:', error);
      }
    }

    // 연결 상태 모니터링
    socket.on('connect', () => {
      console.log('✅ 게임 플레이 소켓 연결됨');
      if (gameCode) {
        socketService.requestGameState(gameCode);
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ 게임 플레이 소켓 연결 해제됨');
    });

    return () => {
      socket.off('gameStarted');
      socket.off('gameStateSync');
      socket.off('questionDisplayed');
      socket.off('timerUpdate');
      socket.off('questionEnded');
      socket.off('gameEnded');
      socket.off('leaderboardUpdate');
      socket.off('participantJoined');
      socket.off('participantLeft');
      socket.off('gameError');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [onGameEnd, gameCode]);



  // 타이머 효과
  useEffect(() => {
    if (timeLeft > 0 && gameState === 'playing') {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [timeLeft, gameState]);

  const handleAnswerSelect = (answerIndex) => {
    if (hasAnswered || gameState !== 'playing') return;
    
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (hasAnswered || !selectedAnswer || gameState !== 'playing') {
      console.log('❌ 답변 제출 실패:', {
        hasAnswered,
        selectedAnswer,
        gameState
      });
      return;
    }

    const timeSpent = currentQuestion.timeLimit - timeLeft;
    console.log('📝 답변 제출 시도:', {
      gameCode,
      selectedAnswer,
      timeSpent
    });

    try {
      socketService.submitAnswer(gameCode, selectedAnswer, timeSpent);
      setHasAnswered(true);
      console.log('✅ 답변 제출 완료');
    } catch (error) {
      console.error('❌ 답변 제출 에러:', error);
      alert('답변 제출에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (gameState === 'waiting') {
    return (
      <div className="game-player">
        <div className="waiting-screen">
          <div className="waiting-icon">⏳</div>
          <h2>게임 대기 중...</h2>
          <p>교사가 게임을 시작할 때까지 기다려주세요.</p>
          
          <div className="participants-preview">
            <h3>참가자 ({participants.length}명)</h3>
            <div className="participants-grid">
              {participants.map((participant, index) => (
                <div key={`${participant.id}-${participant.username}-${index}`} className="participant-badge">
                  <span className="participant-name">{participant.username}</span>
                  <span className="participant-role">
                    {participant.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'showing_results') {
    return (
      <div className="game-player">
        <div className="question-results">
          <div className="results-header">
            <h2>문제 {questionNumber} 결과</h2>
            <p>다음 문제까지 잠시만 기다려주세요...</p>
          </div>
          
          <div className="results-list">
            {questionResults.map((result, index) => (
              <div key={`${result.username}-${index}`} className={`result-item ${result.isCorrect ? 'correct' : 'incorrect'}`}>
                <span className="player-name">{result.username}</span>
                <span className="answer-status">
                  {result.isCorrect ? '✅' : '❌'}
                </span>
                <span className="selected-answer">
                  선택: {result.selectedAnswerText || `옵션 ${result.answer + 1}`}
                </span>
                {!result.isCorrect && (
                  <span className="correct-answer">
                    정답: {result.correctAnswerText || `옵션 ${result.correctAnswerIndex + 1}`}
                  </span>
                )}
                <span className="score-earned">+{result.score}점</span>
                <span className="total-score">총 {result.totalScore}점</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'ended') {
    return (
      <div className="game-player">
        <div className="game-ended">
          <div className="ended-icon">🏁</div>
          <h2>게임 종료!</h2>
          <p>퀴즈가 완료되었습니다.</p>
          
          {leaderboard.length > 0 && (
            <div className="final-leaderboard">
              <h3>최종 순위</h3>
              <div className="leaderboard-list">
                {leaderboard.map((player, index) => (
                  <div key={`${player.id}-${player.username}-${index}`} className={`leaderboard-item rank-${index + 1}`}>
                    <span className="rank">{index + 1}</span>
                    <span className="player-name">{player.username}</span>
                    <span className="player-score">{player.score}점</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="game-player">
        <div className="loading">문제를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="game-player">
      <div className="game-header">
        <div className="question-progress">
          문제 {questionNumber} / {totalQuestions}
        </div>
        <div className="timer">
          ⏰ {formatTime(timeLeft)}
        </div>
      </div>

      <div className="question-container">
        <div className="question-text">
          {currentQuestion.question}
        </div>

        <div className="options-container">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              className={`option-btn ${selectedAnswer === index ? 'selected' : ''} ${hasAnswered ? 'answered' : ''}`}
              onClick={() => handleAnswerSelect(index)}
              disabled={hasAnswered}
            >
              <span className="option-letter">{String.fromCharCode(65 + index)}</span>
              <span className="option-text">{option}</span>
            </button>
          ))}
        </div>

        <div className="answer-actions">
          <button
            className="submit-btn"
            onClick={handleSubmitAnswer}
            disabled={!selectedAnswer || hasAnswered || gameState !== 'playing'}
          >
            {hasAnswered ? '답변 제출됨' : '답변 제출'}
          </button>
        </div>
      </div>

      {leaderboard.length > 0 && (
        <div className="live-leaderboard">
          <h3>실시간 순위</h3>
          <div className="leaderboard-list">
            {leaderboard.slice(0, 5).map((player, index) => (
              <div key={`${player.id}-${player.username}-${index}`} className="leaderboard-item">
                <span className="rank">{index + 1}</span>
                <span className="player-name">{player.username}</span>
                <span className="player-score">{player.score}점</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GamePlayer; 