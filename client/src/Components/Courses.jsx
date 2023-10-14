import React from 'react'
import CourseCard from './Cards/CourseCard'
import CourseAdd from './Cards/CourseAdd'
function Courses() {
    return (
        <div className='flex flex-col  mx-auto w-3/4 min-h-screen items-center p-5'>
            <span className='text-5xl font-semibold mt-5'>Start Learning </span>
            {/* courses div */}
            <div className="w-full flex flex-wrap gap-4 justify-center h-auto p-5 mt-12 summary_box bg-gradient-to-r from-violet-200 to-rose-100">
                <CourseAdd link={'/topic'}/>
                <CourseCard title="Python" link={"/courses/python"} desc="Python is a general-purpose coding language—which means that, unlike HTML, CSS, and JavaScript, it can be used for other types of programming and software development besides web development. That includes back end development, software development, data science and writing system scripts among other things." img="https://via.placeholder.com/150" />
                <CourseCard title="Python" link={"/courses/python"} desc="Python is a general-purpose coding language—which means that, unlike HTML, CSS, and JavaScript, it can be used for other types of programming and software development besides web development. That includes back end development, software development, data science and writing system scripts among other things." img="https://via.placeholder.com/150" />
                <CourseCard title="Python" link={"/courses/python"} desc="Python is a general-purpose coding language—which means that, unlike HTML, CSS, and JavaScript, it can be used for other types of programming and software development besides web development. That includes back end development, software development, data science and writing system scripts among other things." img="https://via.placeholder.com/150" />
                <CourseCard title="Python" link={"/courses/python"} desc="Python is a general-purpose coding language—which means that, unlike HTML, CSS, and JavaScript, it can be used for other types of programming and software development besides web development. That includes back end development, software development, data science and writing system scripts among other things." img="https://via.placeholder.com/150" />
                <CourseCard title="Python" link={"/courses/python"} desc="Python is a general-purpose coding language—which means that, unlike HTML, CSS, and JavaScript, it can be used for other types of programming and software development besides web development. That includes back end development, software development, data science and writing system scripts among other things." img="https://via.placeholder.com/150" />

            </div>

        </div>
    )
}

export default Courses