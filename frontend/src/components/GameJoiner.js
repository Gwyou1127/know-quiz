import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import socketService from '../services/socket';
import './GameJoiner.css';

function GameJoiner({ gameCode: initialGameCode, onGameJoined }) {
  const { currentUser } = useAuth();
  const [gameCode, setGameCode] = useState(initialGameCode || '');
  const [username, setUsername] = useState(currentUser?.displayName || '');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const [gameInfo, setGameInfo] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [gameState, setGameState] = useState('waiting');

  useEffect(() => {
    const socket = socketService.getSocket();

    // 게임 참여 성공
    socket.on('participantJoined', (data) => {
      console.log('✅ 게임 참여 성공:', data);
      console.log('📋 참가자 목록:', data.participants);
      console.log('🎮 게임 상태:', data.gameState);
      
      if (data.participants && Array.isArray(data.participants)) {
        console.log('✅ 참가자 목록 즉시 업데이트됨');
        setParticipants(data.participants);
        
        // 추가로 0.1초 후 다시 한 번 업데이트 (확실성을 위해)
        setTimeout(() => {
          setParticipants(data.participants);
          console.log('🔄 참가자 목록 재업데이트');
        }, 100);
        
        // 추가로 0.3초 후 한 번 더 업데이트
        setTimeout(() => {
          setParticipants(data.participants);
          console.log('🔄 참가자 목록 최종 업데이트');
        }, 300);
      }
      
      setGameState(data.gameState || 'waiting');
      setIsJoining(false);
      setError('');
    });

    // 참가자 퇴장
    socket.on('participantLeft', (data) => {
      console.log('📋 참가자 퇴장:', data);
      setParticipants(data.participants || []);
      setGameState(data.gameState || 'waiting');
    });

    // 게임 시작
    socket.on('gameStarted', (data) => {
      console.log('🎮 게임 시작 이벤트:', data);
      setGameState(data.gameState || 'playing');
      if (onGameJoined) {
        onGameJoined();
      }
    });

    // 게임 상태 동기화
    socket.on('gameStateSync', (data) => {
      console.log('🔄 게임 상태 동기화:', data);
      setGameState(data.gameState);
      
      // 이미 게임이 진행 중이면 바로 게임 화면으로 이동
      if (data.gameState === 'playing' && onGameJoined) {
        onGameJoined();
      }
    });

    // 게임 정보 받기
    socket.on('gameInfo', (data) => {
      console.log('📋 게임 정보:', data);
      setParticipants(data.participants || []);
      setGameState(data.gameState || 'waiting');
    });

    // 에러 처리
    socket.on('gameError', (data) => {
      console.error('🚨 게임 에러:', data);
      // 연결 관련 에러는 alert 표시하지 않음
      if (data.message && !data.message.includes('연결') && !data.message.includes('권한')) {
        setError(data.message || '게임 참여 중 오류가 발생했습니다.');
        setIsJoining(false);
      }
    });

    return () => {
      socket.off('participantJoined');
      socket.off('participantLeft');
      socket.off('gameStarted');
      socket.off('gameStateSync');
      socket.off('gameInfo');
      socket.off('gameError');
    };
  }, [onGameJoined]);

  // 컴포넌트 마운트 시 자동으로 게임 참여
  useEffect(() => {
    if (gameCode && username) {
      try {
        console.log('🎮 자동 게임 참여 시도:', gameCode.toUpperCase(), username);
        socketService.joinGame(gameCode.toUpperCase(), username, 'student');
      } catch (error) {
        console.error('❌ 자동 게임 참여 실패:', error);
        setError('게임 참여에 실패했습니다. 다시 시도해주세요.');
      }
    }
  }, [gameCode, username]);

  const handleJoinGame = () => {
    if (!gameCode || !username) {
      setError('게임 코드와 사용자명을 입력해주세요.');
      return;
    }

    // 게임 코드 형식 검증
    if (!/^[A-Z0-9]{6}$/.test(gameCode.toUpperCase())) {
      setError('올바른 게임 코드를 입력해주세요. (6자리 영문자/숫자)');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      console.log('🎓 학생 게임 참여 시도:', gameCode.toUpperCase(), username);
      socketService.joinGame(gameCode.toUpperCase(), username, 'student');
    } catch (error) {
      console.error('❌ 게임 참여 실패:', error);
      setError('게임 참여에 실패했습니다. 다시 시도해주세요.');
      setIsJoining(false);
    }
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    setError('');
  };

  return (
    <div className="game-joiner">
      <div className="joiner-header">
        <h2>🎯 게임 참여</h2>
        <p>게임 코드를 입력하고 참여하세요.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="join-form">
        <div className="form-group">
          <label htmlFor="gameCode">게임 코드</label>
          <input
            type="text"
            id="gameCode"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            placeholder="게임 코드를 입력하세요"
            maxLength="6"
            disabled={isJoining}
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">사용자명</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={handleUsernameChange}
            placeholder="사용자명을 입력하세요"
            disabled={isJoining}
          />
        </div>

        <button 
          onClick={handleJoinGame}
          className="join-btn"
          disabled={isJoining || !username.trim() || !gameCode.trim()}
        >
          {isJoining ? '참여 중...' : '🎯 게임 참여'}
        </button>
      </div>

      {participants.length > 0 && (
        <div className="participants-section">
          <h3>참가자 목록 ({participants.length}명)</h3>
          <div className="participants-list">
            {participants.map((participant, index) => (
              <div key={`${participant.id}-${participant.username}-${index}`} className="participant-item">
                <span className="participant-name">{participant.username}</span>
                <span className="participant-role">
                  {participant.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="game-status">
          <div className="status-message">
            🎮 게임이 시작되었습니다!
          </div>
        </div>
      )}

      {gameInfo && (
        <div className="game-info">
          <h3>게임 정보</h3>
          <p><strong>퀴즈:</strong> {gameInfo.title}</p>
          <p><strong>설명:</strong> {gameInfo.description}</p>
          <p><strong>문제 수:</strong> {gameInfo.questions?.length || 0}개</p>
        </div>
      )}
    </div>
  );
}

export default GameJoiner; 