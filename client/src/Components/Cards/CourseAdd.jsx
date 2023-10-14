import React from 'react';
import { Link } from 'react-router-dom';
function CourseAdd({link}) {
  return (
    <Link to={link} className="w-70 p-4 bg-white rounded-lg shadow-md transform items-center justify-center hover:scale-105 transition-transform duration-300 ease-in-out text-center">
      <div className='w-70 h-full p-12 bg-violet-100 rounded-lg shadow-md'>
      <span className="text-2xl mt-32">Create course</span>
      <div className="mt-4">
        <span className="text-6xl text-blue-500 font-bold">+</span>
      </div>
      </div>
    </Link>
  );
}

export default CourseAdd;
