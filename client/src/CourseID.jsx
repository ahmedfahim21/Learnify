import { useState, useEffect } from "react"
import { getDoc ,doc} from "firebase/firestore";
import { db } from './firebase'
import {Link} from 'react-router-dom'
import { useParams } from "react-router";
import Backbtn from "./Components/Buttons/Backbtn"
import Flowchart from "./Components/FlowChart";

function CourseID() {

    const courseId = useParams();

    const [item, setItem] = useState({})

    useEffect(() => {
        const fetchCourseData = async () => {
          const documentRef = doc(db, "Course", courseId.id);
    
          try {
            const docSnapshot = await getDoc(documentRef);
    
            if (docSnapshot.exists()) {
              await setItem(docSnapshot.data());
            } else {
              // Handle the case where the document doesn't exist
              console.log("Document does not exist");
            }
          } catch (error) {
            // Handle any errors that occur during the fetch
            console.error("Error fetching document:", error);
          }
        };
        fetchCourseData();
      }, []);



    const [answersVisible, setAnswersVisible] = useState({});
    // const [subpartVisible, setSubpartVisible] = useState({});
    const [faqData, setFaqData] = useState([]);

    useEffect(() => {
    const fetchData = async () => {
        const faqData = [];

        if (!item.modulesList) {
            return;
        }
        const elem = await item.modulesList.topics;
        
        for (let i = 0; i < elem.length; i++) {
            const modulesName = {
                id: i,
                question: elem[i],
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
            };
            faqData.push(modulesName);
        }
        setFaqData(faqData);
    };
    fetchData();
    }, [item]);


    const toggleAnswer = (id) => {
        setAnswersVisible({ ...answersVisible, [id]: !answersVisible[id] });
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
        const progressPercentage = Math.round((completedModules.length / totalModules) * 100);
        setProgress(progressPercentage);
    }, [faqData]);

    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (progress > 0) {
          // Apply a delay to simulate the animation
          const delay = 20; // Adjust as needed
          let currentWidth = 0;
          const interval = setInterval(() => {
            if (currentWidth < progress) {
              currentWidth += 1;
              setWidth(currentWidth);
            } else {
              clearInterval(interval);
            }
          }, delay);
        }
      }, [progress]);
      
      const [width, setWidth] = useState(0);
      
  return (
    <div className="">
            <div className="flex justify-end mr-16 items-end right-0"><Backbtn link={"/courses"}/></div>
    <div className=" flex flex-col min-h-screen w-full mx-auto items-center mt-8">


            <span className="text-5xl w-3/4 text-center mt-1 font-semibold">Let&apos;s Study about <br /> {item.name}</span>
            <span className="mt-5 summary_box w-1/2 text-center flex flex-col">
                <span className="text-xl m-3">Sneak peek into the chapter!</span>
                {item.flowchart &&
                    <Flowchart hierarchicalData={item.flowchart}/>
                }
                <br></br>
                <span>{item.content}</span>
            </span>
            <span className="mt-8 text-3xl font-semibold">Start your course</span>
            
<div className="mt-4 w-1/2 mx-auto items-center">
  <div className="h-6 bg-slate-300 rounded-xl text-center text-black relative">
    <div className="w-full h-full bg-green-500 rounded-xl absolute transition-width duration-1000" style={{ width: `${progress}%` }}>
      {progress > 0 ? `${progress}% completed` : ""}
    </div>
  </div>
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
                                    <div className="cursor-pointer border-b-2 p-2 border-violet-300">
                                    <Link to="./article"
                                        // onClick={() => toggleSubpart(faq.id, answer.sid)}
                                    >
                                        <span className="font-semibold m-2">{answer.title}</span>
                                    </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

    </div>
    </div>
  )
}

export default CourseID