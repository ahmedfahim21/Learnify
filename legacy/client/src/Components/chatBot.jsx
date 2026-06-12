import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ChatBot = ({ article }) => {
  const [userMessages, setUserMessages] = useState([
    { content: article + "\n\nReply as 'Your tutor is ready to assist you.'", role: 'user' },
  ]);

  const [assistantMessages, setAssistantMessages] = useState([
    { content: "Your tutor is ready to assist you.", role: 'assistant' },
  ]);

  const [combinedMessages, setcombinedMessages] = useState([{ content: article + "\n\nReply as 'Your tutor is ready to assist you.'", role: 'user' },
  { content: "Your tutor is ready to assist you.", role: 'assistant' },]);

  const apiUrl = 'http://localhost:5000';

  const [newMessage, setNewMessage] = useState('');

  const handleSendMessage = () => {
    // Create a copy of user messages and add the new user message
    const updatedUserMessages = [...userMessages, { content: newMessage, role: 'user' }];

    setUserMessages(updatedUserMessages);

    axios
      .post(`${apiUrl}/chatBot`, {
        userInput: updatedUserMessages,
      })
      .then((response) => {
        // Add the response to assistant messages
        setAssistantMessages((prevMessages) => [
          ...prevMessages,
          { content: response.data, role: 'assistant' },
        ]);
      })
      .catch((error) => {
        console.log(error);
      });

    // Clear the input field
    setNewMessage('');
    const combinedMessages = [];
  const minMessagesLength = Math.min(userMessages.length, assistantMessages.length);
  for (let i = 0; i < minMessagesLength; i++) {
    combinedMessages.push(userMessages[i]);
    combinedMessages.push(assistantMessages[i]);
  }

  // Append the remaining user messages
  for (let i = minMessagesLength; i < assistantMessages.length; i++) {
    combinedMessages.push(assistantMessages[i]);
  }
  setcombinedMessages(combinedMessages)
  };

  return (
    <div className="w-1/4 border border-gray-300 rounded-lg min-h-96 h-auto mr-5">
      <div className="bg-gradient-to-r from-green-400 to-blue-500 py-2 text-white text-center font-semibold rounded-t-lg">
        AI Tutor
      </div>
      {/* Chat UI */}
      <div className="bg-white p-4 h-full flex flex-col justify-between">
        <div className="flex-1 overflow-y-auto">
        {combinedMessages.map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'text-left mb-2' : 'text-right mb-2'}>
              <span className={message.role === 'user' ? 'bg-blue-500 text-white rounded-md p-2 inline-block max-w-md' : 'bg-gray-500 text-white rounded-md p-2 inline-block max-w-md'}>
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
  );
};

export default ChatBot;
