import React from 'react'
import Backbtn from './Buttons/Backbtn'
function Article() {
  return (
    <div className='w-3/4 mx-auto flex flex-col gap-5 mt-8 min-h-screen  '>
        <div className='flex justify-end'>
            <Backbtn link={'/topic'} />
        </div>
        <span className='text-center text-4xl font-semibold '>Article Heading</span>
        <div className='flex items-center flex-col'>
            <span className='text-md w-full mx-auto summary_box  text-center p-2 '>article content</span>
        </div>

    </div>
  )
}

export default Article