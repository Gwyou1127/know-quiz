import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import QuizCreator from './components/QuizCreator';
import QuizList from './components/QuizList';
import GameJoiner from './components/GameJoiner';
import GamePlayer from './components/GamePlayer';
import TestGame from './components/TestGame';
import socketService from './services/socket';
import './App.css';

function AppContent() {
  const [showAuth, setShowAuth] = useState('login'); // 'login' or 'signup'
  const [role, setRole] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [username, setUsername] = useState('');
  const [currentView, setCurrentView] = useState('main'); // 'main', 'create', 'list', 'game', 'join', 'play'
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [localParticipants, setLocalParticipants] = useState([]); // 별도 로컬 참가자 목록
  const [gameState, setGameState] = useState('waiting');
  const [forceUpdate, setForceUpdate] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [participantUpdateCount, setParticipantUpdateCount] = useState(0); // 참가자 업데이트 카운터
  const { currentUser, logout } = useAuth();

  // 게임 관리 화면에서 소켓 이벤트 처리
  useEffect(() => {
    if (currentView === 'game' && selectedQuiz) {
      const socket = socketService.getSocket();

      // 게임 상태 동기화
      socket.on('gameStateSync', (data) => {
        console.log('🔄 게임 상태 동기화:', data);
        if (data.gameState) {
          setGameState(data.gameState);
          console.log('✅ 게임 상태 업데이트됨:', data.gameState);
        }
      });

      // 참가자 목록 업데이트 (통합 처리)
      socket.on('participantJoined', (data) => {
        console.log('📋 참가자 목록 업데이트 - 참가자 수:', data.participants?.length || 0);
        
        // 참가자 목록 즉시 업데이트
        if (data.participants && Array.isArray(data.participants)) {
          console.log('✅ 참가자 목록 업데이트됨:', data.participants.map(p => p.username));
          
          // 서버 참가자 목록과 로컬 참가자 목록 병합
          const serverParticipants = data.participants;
          const mergedParticipants = [...localParticipants];
          
          // 서버 참가자 목록을 기준으로 병합
          serverParticipants.forEach(serverParticipant => {
            const existingIndex = mergedParticipants.findIndex(p => p.username === serverParticipant.username);
            if (existingIndex !== -1) {
              // 기존 참가자 업데이트
              mergedParticipants[existingIndex] = serverParticipant;
            } else {
              // 새 참가자 추가
              mergedParticipants.push(serverParticipant);
            }
          });
          
          // 중복 제거 (username 기준)
          const uniqueParticipants = mergedParticipants.filter((participant, index, self) =>
            index === self.findIndex(p => p.username === participant.username)
          );
          
          console.log('🔄 병합된 참가자 목록:', uniqueParticipants.map(p => p.username));
          setParticipants(uniqueParticipants);
          setLocalParticipants(uniqueParticipants);
          setParticipantUpdateCount(prev => prev + 1);
          setForceUpdate(prev => prev + 1);
          setLastUpdateTime(Date.now());
          
          // 추가로 0.1초 후 다시 한 번 업데이트 (확실성을 위해)
          setTimeout(() => {
            setParticipants(uniqueParticipants);
            setLocalParticipants(uniqueParticipants);
            setParticipantUpdateCount(prev => prev + 1);
            setForceUpdate(prev => prev + 1);
            setLastUpdateTime(Date.now());
            console.log('🔄 참가자 목록 재업데이트');
          }, 100);
        }
        
        // 게임 상태도 함께 업데이트
        if (data.gameState) {
          setGameState(data.gameState);
        }
      });

      // 참가자 퇴장
      socket.on('participantLeft', (data) => {
        console.log('📋 참가자 퇴장:', data.participants);
        if (data.participants) {
          setParticipants(data.participants);
        }
        if (data.gameState) {
          setGameState(data.gameState);
        }
      });

      // 학생 참여 (교사 전용 이벤트)
      socket.on('studentJoined', (data) => {
        console.log('🎓 학생 참여 이벤트 - 새 학생:', data.student?.username);
        console.log('📋 전체 참가자 목록:', data.allParticipants?.map(p => p.username));
        
        // 참가자 목록 즉시 업데이트
        if (data.allParticipants && Array.isArray(data.allParticipants)) {
          console.log('✅ 학생 참여로 인한 참가자 목록 업데이트됨');
          setParticipants(data.allParticipants);
        }
        
        // 게임 상태도 함께 업데이트
        if (data.gameState) {
          setGameState(data.gameState);
        }
      });

      // 게임 시작
      socket.on('gameStarted', (data) => {
        console.log('게임 시작됨:', data);
        setGameState('playing');
        setSelectedQuiz(prev => ({
          ...prev,
          isActive: true
        }));
      });

      // 게임 종료
      socket.on('gameEnded', (data) => {
        console.log('게임 종료됨:', data);
        setGameState('ended');
        setSelectedQuiz(prev => ({
          ...prev,
          isActive: false
        }));
      });

      // 에러 처리
      socket.on('gameError', (data) => {
        console.error('게임 에러:', data);
        // 연결 관련 에러는 alert 표시하지 않음
        if (data.message && !data.message.includes('연결') && !data.message.includes('권한')) {
          alert(data.message || '게임 관리 중 오류가 발생했습니다.');
        }
      });

      return () => {
        socket.off('participantJoined');
        socket.off('participantLeft');
        socket.off('studentJoined');
        socket.off('gameStarted');
        socket.off('gameEnded');
        socket.off('gameStateSync');
        socket.off('gameError');
      };
    }
  }, [currentView, selectedQuiz]);

  // 게임 관리 화면 진입 시 교사 자동 참여
  useEffect(() => {
    if (currentView === 'game' && selectedQuiz && currentUser) {
      // 참여자 목록 초기화
      setParticipants([]);
      setLocalParticipants([]);
      setGameState('waiting');
      setParticipantUpdateCount(0);
      
      // 교사가 게임에 자동으로 참여
      const joinGame = () => {
        try {
          socketService.joinGame(selectedQuiz.gameCode, currentUser.displayName, 'teacher');
          console.log('교사가 게임에 자동 참여했습니다:', selectedQuiz.gameCode);
          
          // 즉시 참여자 목록에 교사 추가 (로컬 상태)
          const teacherParticipant = {
            id: `teacher-${Date.now()}`,
            socketId: 'teacher',
            username: currentUser.displayName,
            role: 'teacher',
            score: 0
          };
          
          setLocalParticipants(prev => {
            const existing = prev.find(p => p.username === currentUser.displayName);
            if (!existing) {
              console.log('✅ 교사가 로컬 참여자 목록에 즉시 추가됨');
              return [teacherParticipant];
            }
            console.log('⚠️ 교사가 이미 로컬 참여자 목록에 있음');
            return prev;
          });
          
          // 메인 참가자 목록에도 즉시 반영
          setParticipants(prev => {
            const existing = prev.find(p => p.username === currentUser.displayName);
            if (!existing) {
              console.log('✅ 교사가 메인 참여자 목록에 즉시 추가됨');
              return [teacherParticipant];
            }
            console.log('⚠️ 교사가 이미 메인 참여자 목록에 있음');
            return prev;
          });
          
          setParticipantUpdateCount(prev => prev + 1);
          setForceUpdate(prev => prev + 1);
          setLastUpdateTime(Date.now());
          
        } catch (error) {
          console.error('교사 자동 참여 에러:', error);
        }
      };
      
      // 즉시 참여 시도
      joinGame();
      
      // 0.5초 후 다시 한 번 시도 (연결 지연 대비)
      const timer = setTimeout(joinGame, 500);
      
      // 1초 후 한 번 더 시도 (최종 확인)
      const finalTimer = setTimeout(joinGame, 1000);
      
      // 주기적으로 참여자 목록 요청 (1초마다)
      const participantInterval = setInterval(() => {
        const socket = socketService.getSocket();
        socket.emit('requestParticipants', { gameCode: selectedQuiz.gameCode });
      }, 1000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(finalTimer);
        clearInterval(participantInterval);
      };
    } else if (currentView !== 'game') {
      // 게임 관리 화면을 벗어날 때 참여자 목록 초기화
      setParticipants([]);
      setLocalParticipants([]);
      setGameState('waiting');
      setParticipantUpdateCount(0);
    }
  }, [currentView, selectedQuiz, currentUser]);

  const handleJoinGame = () => {
    if (!gameCode || !username) {
      alert('게임 코드와 사용자명을 입력해주세요.');
      return;
    }
    setCurrentView('join');
  };

  const handleCreateGame = () => {
    if (!username) {
      alert('사용자명을 입력해주세요.');
      return;
    }
    setCurrentView('create');
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentView('main');
      setRole('');
      setGameStarted(false);
    } catch (error) {
      console.error('로그아웃 에러:', error);
    }
  };

  const handleQuizCreated = (quizId) => {
    console.log('퀴즈가 생성되었습니다:', quizId);
    setCurrentView('list');
  };

  const handleSelectQuiz = (quiz) => {
    setSelectedQuiz(quiz);
    setCurrentView('game');
  };

  const handleBackToMain = () => {
    setCurrentView('main');
    setRole('');
    setSelectedQuiz(null);
    setGameStarted(false);
    setParticipants([]);
    setGameState('waiting');
  };

  const handleGameJoined = () => {
    setGameStarted(true);
    setCurrentView('play');
  };

  const handleGameEnd = (results) => {
    console.log('게임 종료:', results);
    setGameStarted(false);
    setCurrentView('main');
  };

  const handleStartGame = () => {
    if (!selectedQuiz) return;
    
    try {
      console.log('🎮 게임 시작 시도:', selectedQuiz.gameCode);
      
      // 교사가 게임에 참여 (아직 참여하지 않았다면)
      socketService.joinGame(selectedQuiz.gameCode, currentUser.displayName, 'teacher');
      
      // 참여자 목록에 교사 추가 (즉시 반영)
      const teacherParticipant = {
        id: `teacher-${Date.now()}`,
        socketId: 'teacher',
        username: currentUser.displayName,
        role: 'teacher',
        score: 0
      };
      
      console.log('👨‍🏫 교사를 참여자 목록에 추가:', teacherParticipant);
      setParticipants(prev => {
        const existing = prev.find(p => p.username === currentUser.displayName);
        if (!existing) {
          console.log('✅ 교사가 참여자 목록에 추가됨');
          return [...prev, teacherParticipant];
        }
        console.log('⚠️ 교사가 이미 참여자 목록에 있음');
        return prev;
      });
      
      // 잠시 대기 후 퀴즈 데이터를 서버로 전송
      setTimeout(() => {
        socketService.loadQuiz(selectedQuiz.gameCode, selectedQuiz);
        
        // 다시 잠시 대기 후 게임 시작
        setTimeout(() => {
          socketService.startGame(selectedQuiz.gameCode);
          console.log('게임이 시작되었습니다:', selectedQuiz.gameCode);
        }, 1000);
      }, 500);
      
    } catch (error) {
      console.error('게임 시작 에러:', error);
      alert('게임 시작에 실패했습니다.');
    }
  };

  const handleStopGame = () => {
    if (!selectedQuiz) return;
    
    try {
      // 게임 종료
      socketService.endGame(selectedQuiz.gameCode);
      
      // 퀴즈 상태 업데이트
      setSelectedQuiz(prev => ({
        ...prev,
        isActive: false
      }));
      
      console.log('게임이 중지되었습니다:', selectedQuiz.gameCode);
    } catch (error) {
      console.error('게임 중지 에러:', error);
      alert('게임 중지에 실패했습니다.');
    }
  };

  // 로그인되지 않은 경우 인증 페이지 표시
  if (!currentUser) {
    return (
      <div className="App">
        {showAuth === 'login' ? (
          <Login onSwitchToSignup={() => setShowAuth('signup')} />
        ) : (
          <Register onSwitchToLogin={() => setShowAuth('login')} />
        )}
      </div>
    );
  }

  // 교사 대시보드
  if (currentUser.role === 'teacher') {
    return (
      <div className="App">
        <header className="App-header">
          <div className="header-content">
            <div className="header-left">
              <h1>🎯 Know Quiz</h1>
              <p>교사 대시보드</p>
            </div>
            <div className="header-right">
              <div className="user-info">
                <span>안녕하세요, {currentUser.displayName}님!</span>
                <span className="user-role">(교사)</span>
              </div>
              <button onClick={handleLogout} className="logout-btn">
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <main className="App-main">
          {currentView === 'main' && (
            <div className="teacher-dashboard">
              <div className="welcome-section">
                <h2>교사 대시보드</h2>
                <p>퀴즈를 생성하고 관리하세요.</p>
              </div>

              <div className="dashboard-buttons">
                <button 
                  onClick={() => setCurrentView('create')}
                  className="dashboard-btn primary"
                >
                  ✏️ 퀴즈 만들기
                </button>
                <button 
                  onClick={() => setCurrentView('list')}
                  className="dashboard-btn secondary"
                >
                  📚 퀴즈 목록 보기
                </button>
                <button 
                  onClick={() => setCurrentView('test')}
                  className="dashboard-btn test"
                >
                  🧪 게임 테스트
                </button>
              </div>
            </div>
          )}

          {currentView === 'create' && (
            <div className="create-view">
              <div className="view-header">
                <button onClick={() => setCurrentView('main')} className="back-btn">
                  ← 뒤로 가기
                </button>
                <h2>퀴즈 생성</h2>
              </div>
              <QuizCreator onQuizCreated={handleQuizCreated} />
            </div>
          )}

          {currentView === 'list' && (
            <div className="list-view">
              <div className="view-header">
                <button onClick={() => setCurrentView('main')} className="back-btn">
                  ← 뒤로 가기
                </button>
                <h2>퀴즈 목록</h2>
              </div>
              <QuizList onSelectQuiz={handleSelectQuiz} />
            </div>
          )}

          {currentView === 'test' && (
            <div className="test-view">
              <div className="view-header">
                <button onClick={() => setCurrentView('main')} className="back-btn">
                  ← 뒤로 가기
                </button>
                <h2>게임 테스트</h2>
              </div>
              <TestGame />
            </div>
          )}

          {currentView === 'game' && selectedQuiz && (
            <div className="game-view">
              <div className="view-header">
                <button onClick={() => setCurrentView('list')} className="back-btn">
                  ← 뒤로 가기
                </button>
                <h2>게임 관리: {selectedQuiz.title}</h2>
              </div>
              <div className="game-info">
                <p><strong>게임 코드:</strong> {selectedQuiz.gameCode}</p>
                <p><strong>문제 수:</strong> {selectedQuiz.questions?.length || 0}개</p>
                <p><strong>상태:</strong> 
                  {gameState === 'playing' ? '진행 중' : 
                   gameState === 'ended' ? '종료됨' : 
                   gameState === 'showing_results' ? '결과 표시 중' : 
                   '대기 중'}
                </p>
              </div>
              
              {/* 참가자 목록 */}
              <div className="participants-section">
                <h3>참가자 목록 ({participants.length}명)</h3>
                {participants.length > 0 ? (
                  <div className="participants-list">
                                    {participants.map((participant, index) => (
                  <div key={`${participant.id}-${participant.username}-${index}-${participantUpdateCount}-${forceUpdate}-${lastUpdateTime}`} className="participant-item">
                    <span className="participant-name">{participant.username}</span>
                    <span className="participant-role">
                      {participant.role === 'teacher' ? '👨‍🏫' : '👨‍🎓'}
                    </span>
                  </div>
                ))}
                  </div>
                ) : (
                  <div className="no-participants">
                    <p>아직 참가자가 없습니다.</p>
                    <p>학생들이 게임 코드로 참여할 수 있습니다.</p>
                  </div>
                )}
                <div className="debug-info">
                  <small>게임 상태: {gameState}</small>
                  <br />
                  <small>참가자 수: {participants.length}</small>
                  <br />
                  <small>선택된 퀴즈: {selectedQuiz?.title}</small>
                  <br />
                  <small>게임 코드: {selectedQuiz?.gameCode}</small>
                  <br />
                  <small>마지막 업데이트: {new Date().toLocaleTimeString()}</small>
                  <br />
                  <small>강제 업데이트: {forceUpdate}</small>
                  <br />
                  <small>참가자 업데이트: {participantUpdateCount}</small>
                  <br />
                  <small>로컬 참가자 수: {localParticipants.length}</small>
                  <br />
                  <button 
                    onClick={() => {
                      const socket = socketService.getSocket();
                      socket.emit('requestParticipants', { gameCode: selectedQuiz.gameCode });
                      setForceUpdate(prev => prev + 1);
                      setParticipantUpdateCount(prev => prev + 1);
                    }}
                    style={{ fontSize: '12px', padding: '2px 4px', marginTop: '5px' }}
                  >
                    수동 새로고침
                  </button>
                </div>
              </div>
              
              <div className="game-actions">
                <button 
                  className="action-btn primary"
                  onClick={gameState === 'playing' ? handleStopGame : handleStartGame}
                >
                  {gameState === 'playing' ? '게임 중지' : '게임 시작'}
                </button>
                <button className="action-btn secondary">
                  결과 보기
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // 학생 메인 페이지
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="header-left">
            <h1>🎯 Know Quiz</h1>
            <p>Kahoot! 스타일 실시간 퀴즈 플랫폼</p>
          </div>
          <div className="header-right">
            <div className="user-info">
              <span>안녕하세요, {currentUser.displayName}님!</span>
              <span className="user-role">(학생)</span>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="App-main">
        {currentView === 'main' && (
          <>
            <div className="welcome-section">
              <h2>환영합니다!</h2>
              <p>퀴즈에 참여하세요.</p>
            </div>

            <div className="role-selection">
              <h3>게임 참여</h3>
              <div className="game-section">
                <div className="input-group">
                  <label htmlFor="username">사용자명:</label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="사용자명을 입력하세요"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="gameCode">게임 코드:</label>
                  <input
                    type="text"
                    id="gameCode"
                    value={gameCode}
                    onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                    placeholder="게임 코드를 입력하세요"
                    maxLength="6"
                  />
                </div>

                <div className="action-buttons">
                  <button 
                    className="join-btn"
                    onClick={handleJoinGame}
                    disabled={!username || !gameCode}
                  >
                    🎯 게임 참여
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {currentView === 'join' && (
          <div className="join-view">
            <div className="view-header">
              <button onClick={() => setCurrentView('main')} className="back-btn">
                ← 뒤로 가기
              </button>
              <h2>게임 참여</h2>
            </div>
            <GameJoiner 
              gameCode={gameCode} 
              onGameJoined={handleGameJoined}
            />
          </div>
        )}

        {currentView === 'play' && gameStarted && (
          <div className="play-view">
            <GamePlayer 
              gameCode={gameCode}
              onGameEnd={handleGameEnd}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
