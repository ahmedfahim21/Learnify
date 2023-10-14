import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
const Topic = () => {
    const [answersVisible, setAnswersVisible] = useState({});
    const [subpartVisible, setSubpartVisible] = useState({});
    const [faqData, setFaqData] = useState([
        {
            id: 1,
            question: "Module 1",
            completed: false,
            answers: [
                {
                    sid: 1,
                    title: "Article",
                    link: "/article",
                },
                {
                    sid: 2,
                    title: "Quiz",
                    link: "/quiz",
                },
            ],
        },
        {
            id: 2,
            question: "Module 2",
            completed: false,
            answers: [
                {
                    sid: 3,
                    title: "Article",
                    link: "/article",
                },
                {
                    sid: 4,
                    title: "Quiz",
                    link: "/quiz",
                },
            ],
            // Add more questions and answers as needed
        },
    ]);

    const toggleAnswer = (id) => {
        setAnswersVisible({ ...answersVisible, [id]: !answersVisible[id] });
    };

    const toggleSubpart = (questionId, subpartId) => {
        setSubpartVisible((prevState) => ({
            ...prevState,
            [questionId]: {
                ...prevState[questionId],
                [subpartId]: !prevState[questionId][subpartId],
            },
        }));
    };

    const markModuleAsComplete = (event, moduleId) => {
        event.stopPropagation();
        const updatedFaqData = faqData.map((faq) => {
            if (faq.id === moduleId) {
                // Toggle the completed status
                const updatedFaq = { ...faq, completed: !faq.completed };
                return updatedFaq;
            }
            return faq;
        });
        setFaqData(updatedFaqData);
    };


    useEffect(() => {
        const completedModules = faqData.filter((faq) => faq.completed);
        const totalModules = faqData.length;
        const progressPercentage = (completedModules.length / totalModules) * 100;
        setProgress(progressPercentage);
    }, [faqData]);

    const [progress, setProgress] = useState(0);

    return (
        <div className=" flex flex-col min-h-screen w-1/2  items-start mt-16">
            <span className="text-5xl font-semibold text-center">Let's Study topic</span>
            <span className="mt-5 summary_box w-1/2 text-center flex flex-col">
                <span className="text-xl m-3">Sneak peek into the chapter!</span>
                <span>glimpse will come here</span>
            </span>
            <span className="mt-8 text-3xl font-semibold">Start your course</span>
            <div className="mt-4 w-1/2 mx-auto items-center">
                <div
                    className="h-6 bg-green-500 rounded-xl text-center text-black"
                    style={{ width: `${progress}%` }}
                > {progress}% completed</div>
            </div>
            <div className="w-1/2 p-6 space-y-4 mt-5 summary_box bg-gradient-to-r from-violet-200 to-rose-100 gap-3">
                {faqData.map((faq) => (
                    <div key={faq.id}>
                        <div
                            className="p-4 rounded shadow-md cursor-pointer flex justify-between items-center"
                            onClick={() => toggleAnswer(faq.id)}
                        >
                            <span className="font-semibold">{faq.question}</span>
                            {!faq.completed ? (
                                <button
                                    onClick={(e) => markModuleAsComplete(e, faq.id)}
                                    className="bg-gradient-to-r from-green-700 to-green-600 text-white text-sm p-2 rounded-lg ml-2"
                                >
                                    Mark as Complete
                                </button>
                            ) : (
                                <button
                                    onClick={(e) => markModuleAsComplete(e, faq.id)}
                                    className="bg-gradient-to-r from-red-700 to-red-500 text-sm text-white p-2 rounded-lg ml-2"
                                >
                                    Mark as Incomplete
                                </button>
                            )}
                        </div>
                        <div
                            className={`bg-gradient-to-r from-rose-200 to via-orange-200 p-4 m-1 rounded shadow-md ${answersVisible[faq.id] ? '' : 'hidden'
                                }`}
                        >
                            {faq.answers.map((answer, index) => (
                                <div key={index} className="m-2">
                                    <div
                                        className="cursor-pointer border-b-2 p-2 border-violet-300"
                                        onClick={() => toggleSubpart(faq.id, answer.sid)}
                                    >
                                        <Link to=
                                        {answer.link} className="font-semibold m-2">{answer.title}</Link>
                                    </div>
                                    <div
                                        className={`p-2 ${subpartVisible[faq.id] && subpartVisible[faq.id][answer.sid]
                                                ? ''
                                                : 'hidden'
                                            }`}
                                    >
                                        <div>{answer.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
};

export default Topic;
