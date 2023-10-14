import React, { useState } from 'react';

const Quiz = () => {
  const quizData = [
    // ... Your quiz questions and options ...
    {
        question: 'What is the capital of France?',
        options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
        correctAnswer: 'Paris',
      },
      {
        question: 'What is the capital of France2?',
        options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
        correctAnswer: 'Paris',
      },
      {
        question: 'What is the capital of France3?',
        options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
        correctAnswer: 'Paris',
      },
  ];

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswers, setUserAnswers] = useState(new Array(quizData.length).fill(''));
  const [showScore, setShowScore] = useState(false);

  const handleOptionClick = (selectedOption) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestion] = selectedOption;
    setUserAnswers(newAnswers);
  };

  const handleNextClick = () => {
    if (currentQuestion < quizData.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevClick = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleQuizSubmit = () => {
    const correctAnswers = quizData.map((q) => q.correctAnswer);
    const score = userAnswers.filter((answer, index) => answer === correctAnswers[index]).length;
    setShowScore(score);
  };

  return (
    <div className="bg-gray-100 p-4 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-4">Quiz Time!</h2>
      {!showScore && (
        <div>
          <p className="text-lg mb-4">{quizData[currentQuestion].question}</p>
          <div className="space-y-2">
            {quizData[currentQuestion].options.map((option, index) => (
              <button
                key={index}
                className={`bg-white hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 p-2 rounded-lg w-full ${
                  userAnswers[currentQuestion] === option ? 'bg-blue-500 text-white' : ''
                }`}
                onClick={() => handleOptionClick(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {currentQuestion > 0 && (
              <button
                className="bg-blue-500 text-white font-semibold hover:bg-blue-700 p-2 rounded-lg mr-4"
                onClick={handlePrevClick}
              >
                Previous
              </button>
            )}
            {currentQuestion < quizData.length - 1 && (
              <button
                className="bg-blue-500 text-white font-semibold hover:bg-blue-700 p-2 rounded-lg"
                onClick={handleNextClick}
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
      {!showScore && (
        <button
          className="bg-blue-500 text-white font-semibold hover:bg-blue-700 p-2 rounded-lg mt-4"
          onClick={handleQuizSubmit}
        >
          Submit
        </button>
      )}
      {showScore && (
        <div>
          <p className="text-xl font-semibold mt-4">Quiz completed!</p>
          <p className="text-lg mt-4">Your score: {showScore} out of {quizData.length}</p>
        </div>
      )}
    </div>
  );
};

export default Quiz;
