import React, { useState } from 'react';
import Backbtn from './Buttons/Backbtn';

function Article() {
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
    <div className='min-h-screen'>
      <div className='flex justify-end mr-12'>
          <Backbtn link={'../'} />

        </div>
    <div className="w-full flex gap-5 mt-8 ">




      <div className='w-1/2 mx-auto flex flex-col gap-5  '>
        
        <span className="text-center text-4xl font-semibold">Article Heading</span>
        <div className="flex items-center flex-col">
          <span className="text-md w-full mx-auto summary_box text-center p-2">
            Article content
          </span>
        </div>
      </div>


      <div className="w-1/4 border border-gray-300 rounded-lg min-h-96 max-h-screen mr-5">
        <div className="bg-gradient-to-r from-violet-500 to-blue-500 p-2 text-white text-center  rounded-t-lg">
         <span className='font-semibold'> AI Tutor <br /></span>
         <span className='text-sm'>Get your doubts cleared</span>
        </div>
        {/* Chat UI */}
        <div className="bg-white p-4 h-full flex flex-col justify-between">
          <div className="flex-1 overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role == 'user' ? 'text-right mb-2' : 'text-left mb-2'}
              >
                <span className={message.role === 'user' ? 'bg-blue-500 text-white rounded-xl rounded-br-sm p-2 inline-block max-w-md' : 'bg-gray-500 text-white rounded-xl rounded-bl-sm p-2 inline-block max-w-md'}>
                  {message.content}
                </span>
              </div>
            ))}
          </div>
          <div className="flex">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border p-2 rounded-l-md"
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-500 text-white rounded-r-md p-2 hover:bg-blue-700"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>

  );
}

export default Article;
