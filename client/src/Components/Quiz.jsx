import React, { useState, useEffect } from 'react';

const Quiz = () => {

  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  useEffect(() => {
    let interval;

    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const handleStartStopTimer = () => {
    setIsTimerRunning(!isTimerRunning);
  };

  
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
    // Stop the timer when the user submits
    setIsTimerRunning(false);

    // Calculate the score
    const correctAnswers = quizData.map((q) => q.correctAnswer);
    const score = userAnswers.filter((answer, index) => answer === correctAnswers[index]).length;

    // Display the score and time taken
    setShowScore(score);
  };


  return (
  
    <div className=" p-5 w-2/3 mt-12 mx-auto rounded-lg shadow-md mb-32 ">
    <div className='flex justify-between'>
    <h2 className="text-2xl font-semibold mb-4">Quiz Time! </h2>
    {!showScore && (  
    <div className=''>
    <button
        className={`mx-3 bg-gradient-to-l from-blue-600 to-violet-600 text-white py-1 px-5 rounded-lg ${isTimerRunning ? 'bg-red-500' : ''}`}
        onClick={handleStartStopTimer}
      >
        {isTimerRunning ? 'Stop' : 'Start'} 
      </button>
      {isTimerRunning && `${timer} Seconds`}
    </div>
    )
}

     
      
    </div>
      {isTimerRunning &&!showScore && (
        <div className='summary_box'>
          <p className="text-lg mb-4">{quizData[currentQuestion].question}</p>
          <div className="space-y-2 ">
            {quizData[currentQuestion].options.map((option, index) => (
              <button
                key={index}
                className={`bg-gradient-to-l from-violet-300 to bg-blue-300 hover:from-violet-400 hover:to-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 p-2 rounded-lg w-full ${
                  userAnswers[currentQuestion] === option ? 'bg-blue-500 text-white' : ''
                }`}
                onClick={() => handleOptionClick(option)}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            {currentQuestion > 0 && (
             <button
                className="bg-violet-500 text-white  hover:bg-violet-700 p-2 rounded-lg mr-4"
                onClick={handlePrevClick}
              >
                Previous
              </button>
            )}
            {currentQuestion < quizData.length - 1 && (
              <button
                className="bg-violet-500 text-white hover:bg-violet-700 p-2 rounded-lg"
                onClick={handleNextClick}
              >
                Next
              </button>
            )}
          </div>
        </div>
      )
      }
      {!isTimerRunning && !showScore && (
        <span className='text-center min-h-32 text-lg'>Click on start when you are ready!</span>
      )
      }

      {isTimerRunning && !showScore && (
        <button
          className="bg-violet-500 text-white  hover:bg-violet-700 p-2 rounded-lg mt-4"
          onClick={handleQuizSubmit}
        >
          Submit
        </button>
      )}
      {showScore && (
        <div>
          <p className="text-xl font-semibold mt-4">Quiz completed!</p>
          <p className="text-lg mt-4">Your score: {showScore} out of {quizData.length}</p>
          <p className="text-lg mt-4">Time taken: {timer} seconds</p>
        </div>
      )}
    </div>
  
  );
};

export default Quiz;