import React, { useState } from 'react';

function Faq() {
  // Define an array of FAQ items with questions and answers
  const faqItems = [
    {
        "question": "How does your AI-powered platform assist in studying?",
        "answer": "Our AI-powered platform enhances the studying experience by providing personalized recommendations, smart quizzes. "
      },
      {
        "question": "What subjects and topics are covered by your edtech platform?",
        "answer": "Our platform covers a wide range of subjects, from mathematics and science to literature and history. You can find study materials and resources for various topics, ensuring a comprehensive learning experience."
      },
      {
        "question": "Is my personal data safe and secure with your platform?",
        "answer": "We take data security seriously. Your personal information and study data are encrypted and stored securely. We adhere to strict privacy standards to ensure the confidentiality and integrity of your data."
      },
      {
        "question": "How can I get started with your AI-driven study tools?",
        "answer": "Simply open our home page and click on get started then choose from already created courses or create your own course."
      },
      {
        "question": "What makes your edtech startup stand out from the rest?",
        "answer": "What sets us apart is our commitment to providing innovative AI solutions that empower students to study smarter, not harder. We continuously evolve to offer cutting-edge features and help."
      }
  ];

  // State to track which FAQ items are open
  const [openItems, setOpenItems] = useState([]);

  // Function to toggle the open/closed state of a FAQ item
  const toggleItem = (index) => {
    if (openItems.includes(index)) {
      // If the item is open, close it
      setOpenItems(openItems.filter((item) => item !== index));
    } else {
      // If the item is closed, open it
      setOpenItems([...openItems, index]);
    }
  };

  return (
    <div className="w-3/4  container mx-auto p-4 h-screen ">
      <h1 className="text-3xl font-semibold mb-4">Frequently Asked Questions</h1>
      <div>
        {faqItems.map((item, index) => (
          <div key={index} className="mb-4">
            <div
              className="cursor-pointer flex justify-between summary_box items-center rounded-xl  p-4"
              onClick={() => toggleItem(index)}
            >
              <div className="font-semibold ">{item.question}</div>
              <div>{openItems.includes(index) ? '▼' : '▲'}</div>
            </div>
            {openItems.includes(index) && (
              <div className="p-2">{item.answer}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Faq;