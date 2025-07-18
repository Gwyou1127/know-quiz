import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    try {
      // 서버 주소를 동적으로 설정
      let serverUrl = process.env.REACT_APP_SERVER_URL;
      
      if (!serverUrl) {
        // 현재 호스트의 IP 주소를 자동으로 감지
        const hostname = window.location.hostname;
        const port = '3001';
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
          serverUrl = `http://localhost:${port}`;
        } else {
          // 다른 컴퓨터에서 접속할 때는 현재 호스트의 IP 사용
          serverUrl = `http://${hostname}:${port}`;
        }
      }
      
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 20000, 
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket.io 연결됨:', this.socket.id);
        console.log('📍 서버 URL:', serverUrl);
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ Socket.io 연결 해제됨. 이유:', reason);
        this.isConnected = false;
        
        // 자동 재연결 시도
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`🔄 재연결 시도 ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        }
      });

      this.socket.on('connect_error', (error) => {
        console.error('🚨 Socket.io 연결 에러:', error);
        console.error('📍 서버 URL:', serverUrl);
        console.error('📍 에러 타입:', error.type);
        console.error('📍 에러 메시지:', error.message);
        this.isConnected = false;
        
        // 재연결 시도
        setTimeout(() => {
          if (!this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
            console.log('🔄 재연결 시도 중...');
            this.disconnect();
            this.connect();
          }
        }, 3000);
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('✅ Socket.io 재연결됨:', attemptNumber);
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('🚨 Socket.io 재연결 에러:', error);
        this.reconnectAttempts++;
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ Socket.io 재연결 실패 - 최대 시도 횟수 초과');
        this.isConnected = false;
      });

      return this.socket;
    } catch (error) {
      console.error('Socket.io 초기화 에러:', error);
      return null;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getSocket() {
    if (!this.socket || !this.isConnected) {
      return this.connect();
    }
    return this.socket;
  }

  // 게임 참여
  joinGame(gameCode, username, role) {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error('소켓 연결이 없습니다.');
    }
    
    console.log(`🎮 게임 참여 시도: ${gameCode}, ${username}, ${role}`);
    socket.emit('joinGame', { gameCode, username, role });
  }

  // 퀴즈 데이터 로드 (교사만)
  loadQuiz(gameCode, quizData) {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error('소켓 연결이 없습니다.');
    }
    
    console.log(`📚 퀴즈 데이터 로드: ${gameCode}`);
    socket.emit('loadQuiz', { gameCode, quizData });
  }

  // 게임 시작 (교사만)
  startGame(gameCode) {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error('소켓 연결이 없습니다.');
    }
    
    console.log(`🎮 게임 시작: ${gameCode}`);
    socket.emit('startGame', { gameCode });
  }

  // 게임 종료 (교사만)
  endGame(gameCode) {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error('소켓 연결이 없습니다.');
    }
    
    console.log(`🏁 게임 종료: ${gameCode}`);
    socket.emit('endGame', { gameCode });
  }

  // 답변 제출
  submitAnswer(gameCode, answer, timeSpent) {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error('소켓 연결이 없습니다.');
    }
    
    console.log(`✅ 답변 제출: ${gameCode}, 답변: ${answer}, 소요시간: ${timeSpent}초`);
    
    try {
      socket.emit('submitAnswer', { gameCode, answer, timeSpent });
      console.log('📤 답변 제출 이벤트 전송 완료');
    } catch (error) {
      console.error('❌ 답변 제출 이벤트 전송 실패:', error);
      throw error;
    }
  }

  // 참여자 목록 요청
  requestParticipants(gameCode) {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error('소켓 연결이 없습니다.');
    }
    
    console.log(`📋 참여자 목록 요청: ${gameCode}`);
    socket.emit('requestParticipants', { gameCode });
  }

  // 연결 상태 확인
  isSocketConnected() {
    return this.isConnected && this.socket && this.socket.connected;
  }

  // 연결 상태 모니터링
  onConnectionChange(callback) {
    const socket = this.getSocket();
    if (socket) {
      socket.on('connect', () => callback(true));
      socket.on('disconnect', () => callback(false));
    }
  }

  // 게임 상태 동기화 요청
  requestGameState(gameCode) {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error('소켓 연결이 없습니다.');
    }
    
    console.log(`🔄 게임 상태 동기화 요청: ${gameCode}`);
    socket.emit('requestGameState', { gameCode });
  }

  // 퀴즈 데이터 설정 (교사만)
  setQuizData(gameCode, quizData) {
    const socket = this.getSocket();
    if (!socket) {
      throw new Error('소켓 연결이 없습니다.');
    }
    
    console.log(`📝 퀴즈 데이터 설정: ${gameCode}`);
    socket.emit('setQuizData', { gameCode, quizData });
  }

  // 게임 코드 생성
  generateGameCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 연결 상태 로그
  logConnectionStatus() {
    console.log('📊 소켓 연결 상태:', {
      isConnected: this.isConnected,
      socketExists: !!this.socket,
      socketConnected: this.socket?.connected,
      reconnectAttempts: this.reconnectAttempts
    });
  }

  // 에러 처리 개선
  handleError(error, context = '') {
    console.error(`🚨 소켓 에러 (${context}):`, error);
    
    // 재연결 시도
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`🔄 에러로 인한 재연결 시도 ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts}`);
      setTimeout(() => {
        this.connect();
      }, 2000);
    }
  }
}

const socketService = new SocketService();
export default socketService; 