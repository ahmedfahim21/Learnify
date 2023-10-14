import React, { useState } from 'react';
import Backbtn from './Buttons/Backbtn';

function Article() {
  const [messages, setMessages] = useState([
    { text: 'Hello!', sender: 'user' },
    { text: 'Hi there!', sender: 'bot' },
  ]);

  const [newMessage, setNewMessage] = useState('');
  // const messagesContainerRef = useRef(null);

  const handleSendMessage = () => {
    if (newMessage.trim() !== '') {
      setMessages((prevMessages) => [...prevMessages, { text: newMessage, sender: 'user' }]);
      setNewMessage('');
      // Simulate a bot response (you can replace this with actual bot logic)
      setTimeout(() => {
        setMessages((prevMessages) => [...prevMessages, { text: 'I am a bot.', sender: 'bot' }]);
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


      <div className="w-1/4 border border-gray-300 rounded-lg min-h-96 h-auto mr-5">
        <div className="bg-gradient-to-r from-green-400 to-blue-500 py-2 text-white text-center font-semibold rounded-t-lg">
          AI Tutor
        </div>
        {/* Chat UI */}
        <div className="bg-white p-4 h-full flex flex-col justify-between">
          <div className="flex-1 overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.sender == 'user' ? 'text-right mb-2' : 'text-left mb-2'}
              >
                <span className={message.sender === 'user' ? 'bg-blue-500 text-white rounded-md p-2 inline-block max-w-md' : 'bg-gray-500 text-white rounded-md p-2 inline-block max-w-md'}>
                  {message.text}
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
