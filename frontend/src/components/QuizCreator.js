import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './QuizCreator.css';

function QuizCreator({ onQuizCreated }) {
  const { currentUser } = useAuth();
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    questions: []
  });
  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    timeLimit: 30
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleQuizDataChange = (field, value) => {
    setQuizData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleQuestionChange = (field, value) => {
    setCurrentQuestion(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOptionChange = (index, value) => {
    setCurrentQuestion(prev => ({
      ...prev,
      options: prev.options.map((option, i) => 
        i === index ? value : option
      )
    }));
  };

  const addQuestion = () => {
    if (!currentQuestion.question.trim()) {
      setError('문제를 입력해주세요.');
      return;
    }

    if (currentQuestion.options.some(option => !option.trim())) {
      setError('모든 보기를 입력해주세요.');
      return;
    }

    setQuizData(prev => ({
      ...prev,
      questions: [...prev.questions, { ...currentQuestion }]
    }));

    setCurrentQuestion({
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      timeLimit: 30
    });

    setError('');
  };

  const removeQuestion = (index) => {
    setQuizData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== index)
    }));
  };

  const createQuiz = async () => {
    if (!quizData.title.trim()) {
      setError('퀴즈 제목을 입력해주세요.');
      return;
    }

    if (quizData.questions.length === 0) {
      setError('최소 하나의 문제를 추가해주세요.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const quizDoc = await addDoc(collection(db, 'quizzes'), {
        ...quizData,
        createdBy: currentUser.uid,
        createdByUsername: currentUser.displayName,
        createdAt: serverTimestamp(),
        isActive: false,
        gameCode: generateGameCode()
      });

      console.log('퀴즈가 생성되었습니다:', quizDoc.id);
      
      if (onQuizCreated) {
        onQuizCreated(quizDoc.id);
      }
    } catch (error) {
      setError('퀴즈 생성에 실패했습니다. 다시 시도해주세요.');
      console.error('퀴즈 생성 에러:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateGameCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  return (
    <div className="quiz-creator">
      <div className="creator-header">
        <h2>🎯 새 퀴즈 생성</h2>
        <p>퀴즈 제목과 문제들을 입력해주세요.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="quiz-info-section">
        <h3>퀴즈 정보</h3>
        <div className="form-group">
          <label htmlFor="quizTitle">퀴즈 제목</label>
          <input
            type="text"
            id="quizTitle"
            value={quizData.title}
            onChange={(e) => handleQuizDataChange('title', e.target.value)}
            placeholder="퀴즈 제목을 입력하세요"
          />
        </div>
        <div className="form-group">
          <label htmlFor="quizDescription">퀴즈 설명</label>
          <textarea
            id="quizDescription"
            value={quizData.description}
            onChange={(e) => handleQuizDataChange('description', e.target.value)}
            placeholder="퀴즈에 대한 설명을 입력하세요"
            rows="3"
          />
        </div>
      </div>

      <div className="questions-section">
        <h3>문제 목록 ({quizData.questions.length}개)</h3>
        
        {quizData.questions.map((question, index) => (
          <div key={index} className="question-item">
            <div className="question-header">
              <span className="question-number">문제 {index + 1}</span>
              <button 
                onClick={() => removeQuestion(index)}
                className="remove-question-btn"
              >
                삭제
              </button>
            </div>
            <div className="question-content">
              <p><strong>문제:</strong> {question.question}</p>
              <p><strong>정답:</strong> {question.options[question.correctAnswer]}</p>
              <p><strong>제한시간:</strong> {question.timeLimit}초</p>
            </div>
          </div>
        ))}

        <div className="add-question-section">
          <h4>새 문제 추가</h4>
          
          <div className="form-group">
            <label htmlFor="questionText">문제</label>
            <textarea
              id="questionText"
              value={currentQuestion.question}
              onChange={(e) => handleQuestionChange('question', e.target.value)}
              placeholder="문제를 입력하세요"
              rows="3"
            />
          </div>

          <div className="options-section">
            <label>보기</label>
            {currentQuestion.options.map((option, index) => (
              <div key={index} className="option-input">
                <input
                  type="radio"
                  name="correctAnswer"
                  checked={currentQuestion.correctAnswer === index}
                  onChange={() => handleQuestionChange('correctAnswer', index)}
                />
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`보기 ${index + 1}`}
                />
              </div>
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="timeLimit">제한시간 (초)</label>
            <input
              type="number"
              id="timeLimit"
              value={currentQuestion.timeLimit}
              onChange={(e) => handleQuestionChange('timeLimit', parseInt(e.target.value))}
              min="10"
              max="300"
            />
          </div>

          <button 
            onClick={addQuestion}
            className="add-question-btn"
          >
            ➕ 문제 추가
          </button>
        </div>
      </div>

      <div className="create-quiz-section">
        <button 
          onClick={createQuiz}
          className="create-quiz-btn"
          disabled={loading || quizData.questions.length === 0}
        >
          {loading ? '퀴즈 생성 중...' : '🎮 퀴즈 생성'}
        </button>
      </div>
    </div>
  );
}

export default QuizCreator; 