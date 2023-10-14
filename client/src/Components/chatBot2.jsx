import React, {useState} from 'react';

function MainBox({article}){
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([
        {
            message: article + "\n\nReply as 'Your tutor is ready to assist you.'",
            sender: "user"
        },

        {
            message: "Your tutor is ready to assist you.",
            sender: "ChatGPT"
        }
    ]);
    const apiUrl = 'http://localhost:5000';

    const handleChange = (event)=>{
        setInput(event.target.value)
    }

    const handleSend = async (event)=>{
        event.preventDefault()
        const newMessage = {
            message: input,
            sender: "user"
        }

        const newMessages = [...messages,newMessage];

        setMessages(newMessages);

        setInput('');

        await processMessageToChatGPT(newMessages);
    }

    async function processMessageToChatGPT(chatMessages){
        
        let apiMessages = chatMessages.map((messageObject)=>{
            let role="";
            if(messageObject.sender === "ChatGPT"){
                role = "assistant"
            }else{
                role = "user"
            }
            return (
                {role: role, content: messageObject.message}
            )
        });

        const systemMessage = {
            role: "system",
            content: "Explain all concept like i am 10 year old"
        }

        const apiRequestBody = {
            "model": "gpt-3.5-turbo",
            "messages": [
                systemMessage,
                ...apiMessages
            ]
        }

        await fetch(`${apiUrl}/chatBot2`,{
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(apiRequestBody)
        }).then((response)=>{
            return response.json();
        }).then((data)=>{
            console.log(data.choices[0].message.content);
            setMessages(
                [
                    ...chatMessages,
                    {
                        message: data.choices[0].message.content,
                        sender: "ChatGPT"
                    }
                ]
            )
        })
    }

    return (
        <div  className='mx-5'>
			{/* <div className="response-area overflow-x-hidden min-h-96 bg-gradient-to-r from-violet-200 to-blue-200 rounded-t-lg summary_box rounded-bl-sm">
                {messages.map((message, index) => {
                    return index == 0 ? <div/> :(
                        <div className={message.sender==="ChatGPT" ? 'gpt-message message bg-violet-400 max-w-sm  ' : 'user-message message max-w-sm bg-blue-400'}>{message.message}</div>
                    );
                })}
            </div> */}
           
      <div className="border  rounded-lg rounded-b-sm   mr-5 overflow-y-auto max-h-screen">
        <div className="bg-gradient-to-r from-violet-500 to-blue-500 p-2 text-white text-center  rounded-t-lg">
         <span className='font-semibold'> AI Tutor <br /></span>
         <span className='text-sm'>Get your doubts cleared</span>
        </div>
        {/* Chat UI */}
            <div className='p-2 summary_box '>
            {messages.map((message, index) => (
              <div
                key={index}
               
                className={message.sender == 'user' ? 'text-right mb-2' : 'text-left mb-2'}
              >
                
                <span className={message.sender === 'ChatGPT' ? 'bg-blue-500 text-white rounded-xl rounded-bl-sm p-2 inline-block max-w-md' : 'bg-violet-500 text-white rounded-xl rounded-br-sm p-2 inline-block max-w-md'}>
                  {message.message}
                </span>
              </div>
            ))}
            </div>
        </div>
            <div className="flex">
            <input
              type="text"
              value={input}
              onChange={handleChange}
              placeholder="Type a message..."
              className="flex-1 shadow-sm p-2 rounded-l-md"
            />
            <button
              onClick={handleSend}
              className="bg-blue-500 text-white rounded-r-md p-2 mr-5 hover:bg-blue-700"
            >
              Send
            </button>
          </div>
{/* 
			<div className="prompt-area">
				<input type="text" placeholder="Send a message..." value={input} onChange={handleChange}/>
				<button className="submit" type="submit" onClick={handleSend}>Send</button>
			</div> */}
		</div>
    );
}

export default MainBox;