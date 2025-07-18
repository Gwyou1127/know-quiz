import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import './QuizList.css';

function QuizList({ onSelectQuiz }) {
  const { currentUser } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      setError('');

      const quizzesRef = collection(db, 'quizzes');
      const q = query(
        quizzesRef,
        where('createdBy', '==', currentUser.uid)
        // orderBy('createdAt', 'desc') // 인덱스 생성 후 활성화
      );

      const querySnapshot = await getDocs(q);
      const quizzesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 클라이언트 측에서 정렬
      const sortedQuizzes = quizzesData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA; // 최신순 정렬
      });

      setQuizzes(sortedQuizzes);
    } catch (error) {
      setError('퀴즈 목록을 불러오는데 실패했습니다.');
      console.error('퀴즈 목록 로드 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '날짜 없음';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (quiz) => {
    if (quiz.isActive) {
      return <span className="status-badge active">진행 중</span>;
    } else {
      return <span className="status-badge inactive">대기 중</span>;
    }
  };

  if (loading) {
    return (
      <div className="quiz-list">
        <div className="loading">퀴즈 목록을 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="quiz-list">
      <div className="list-header">
        <h2>📚 내 퀴즈 목록</h2>
        <p>생성한 퀴즈들을 관리하세요.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {quizzes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>아직 생성된 퀴즈가 없습니다</h3>
          <p>새로운 퀴즈를 생성해보세요!</p>
        </div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.map((quiz) => (
            <div key={quiz.id} className="quiz-card">
              <div className="quiz-header">
                <h3>{quiz.title}</h3>
                {getStatusBadge(quiz)}
              </div>
              
              <div className="quiz-content">
                <p className="quiz-description">
                  {quiz.description || '설명이 없습니다.'}
                </p>
                
                <div className="quiz-stats">
                  <div className="stat">
                    <span className="stat-label">문제 수:</span>
                    <span className="stat-value">{quiz.questions?.length || 0}개</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">게임 코드:</span>
                    <span className="stat-value game-code">{quiz.gameCode}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">생성일:</span>
                    <span className="stat-value">{formatDate(quiz.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="quiz-actions">
                <button 
                  onClick={() => onSelectQuiz(quiz)}
                  className="action-btn primary"
                >
                  {quiz.isActive ? '게임 관리' : '게임 시작'}
                </button>
                <button className="action-btn secondary">
                  편집
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default QuizList; 