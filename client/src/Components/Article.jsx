import React, { useState } from 'react';
import Backbtn from './Buttons/Backbtn';
import ChatBot from './chatBot';
import MainBox from './chatBot2';
import axios from 'axios';

function Article() {


  const article = "The French Revolution, a seminal event in late 18th-century France, marked a watershed moment in the history of both the nation and the modern world. Emerging in 1789, it was driven by a complex web of social, political, and economic factors. The revolution began with a groundswell of discontent among the common people, who were suffering under heavy taxation, while the nobility and clergy enjoyed privileges and tax exemptions. This discontent culminated in the famous storming of the Bastille in July 1789, which symbolized the people's revolt against oppression. As the revolution unfolded, it went through various phases, including the Reign of Terror led by Maximilien Robespierre, which saw mass executions and radical political changes.";





  
  



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


      
    {/* <ChatBot article={article}/> */}

    <MainBox article={article}/>





    </div>
    </div>

  );
}

export default Article;
