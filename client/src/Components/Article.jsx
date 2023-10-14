import  { useState } from 'react';
import Backbtn from './Buttons/Backbtn';
import ChatBot from './chatBot';
import MainBox from './chatBot2';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useEffect } from 'react';
import { doc, getDoc,updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

function Article() {

  const param = useParams();
  const savedArticle = param.article;
  const apiUrl = 'http://localhost:5000';

  const [article, setArticleData] = useState([]);
  const [status, setStatus] = useState(false);

  useEffect(() => {
    const fetchCourseData = async () => {
      const documentRef = doc(db, "Course", param.id);

      try {
        const docSnapshot = await getDoc(documentRef);

        if (docSnapshot.exists()) {
          const res = await docSnapshot.data();
          // console.log(res[savedArticle]);

          if(res[savedArticle] == undefined){
            // request to server
            const postData = {
              userInput: `${savedArticle}`
            };

            try {
              // Make an asynchronous POST request
              const normalArticle = await axios.post(`${apiUrl}/get_Article`, postData);
              // console.log(normalArticle.data)
              await updateDoc(documentRef, {
                [savedArticle]: normalArticle.data
              });
            }
            catch (error) {
              // Handle any errors that occur during the fetch
              console.error("Error fetching document:", error);
            }

          }
          setArticleData(res[savedArticle]);
          setStatus(true);

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
  }, [savedArticle]);

  // const article = "The French Revolution, a seminal event in late 18th-century France, marked a watershed moment in the history of both the nation and the modern world. Emerging in 1789, it was driven by a complex web of social, political, and economic factors. The revolution began with a groundswell of discontent among the common people, who were suffering under heavy taxation, while the nobility and clergy enjoyed privileges and tax exemptions. This discontent culminated in the famous storming of the Bastille in July 1789, which symbolized the people's revolt against oppression. As the revolution unfolded, it went through various phases, including the Reign of Terror led by Maximilien Robespierre, which saw mass executions and radical political changes.";


  const [messages, setMessages] = useState([
    { content: 'Hello!', role: 'user' },
    { content: 'Hi there!', role: 'assistant' },
  ]);

  const [newMessage, setNewMessage] = useState('');
  // const messagesContainerRef = useRef(null);

  const handleSendMessage = () => {
    if (newMessage.trim() !== '') {
      setMessages((prevMessages) => [...prevMessages, { content: newMessage, role: 'user' }]);
      setNewMessage('');
      // Simulate a bot response (you can replace this with actual bot logic)
      setTimeout(() => {
        setMessages((prevMessages) => [...prevMessages, { content: 'I am a bot.', role: 'bot' }]);
      }, 2000);
    }
  };


  const fetchResponse = async () => {
    // const response = await fetch('https://api.github.com/users');
    // const data = await response.json();


    // console.log(data);
  };

  const handleSend = () => {
    handleSendMessage();
    fetchResponse();
  }

  // useEffect(() => {
  //   // Automatically scroll to the end of the chat container
  //   if (messagesContainerRef.current) {
  //     messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  //   }
  // }, [messages]);


  return (
    <div className='min-h-screen w-3/4 mx-auto gap-5 mb-32'>
      <div className='flex justify-end mr-12'>
        <Backbtn link={'../'} />

      </div>
      <div className="w-full flex gap-5 mt-8 ">




        <div className='w-3/4 mx-auto flex flex-col gap-5  '>


      <div className='w-1/2 mx-auto flex flex-col gap-5  '>
        
        <span className="text-center text-4xl font-semibold">Article Heading</span>
        <div className="flex items-center flex-col">
          <span className="text-md w-full mx-auto summary_box text-center p-2">
            Article content
            <br/>
            {
              status ? <span>{article}</span> : <span>Loading...</span>
            }
          </span>

        </div>



        {/* <ChatBot article={article}/> */}

        <div className='w-1/3'>
        <MainBox article={article} />
        </div>


    </div>

    </div>

  );
}

export default Article;
