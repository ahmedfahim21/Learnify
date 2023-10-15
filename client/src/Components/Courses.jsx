import { useEffect, useState } from 'react'
import { collection, addDoc, onSnapshot, query} from "firebase/firestore"; 
import { db } from '../firebase'
import CourseCard from './Cards/CourseCard'
import axios from 'axios'
import {motion} from 'framer-motion'
import { fadeInAnimation } from './animation';
import Loader from './Loader';

function Courses() {

    const apiUrl = 'http://localhost:5000';
    const [course, setChapters] = useState([])
    const [loading, setLoading] = useState(false)


    function CourseAdd() {
        const [newChapter, setNewChapter] = useState({ name: ''})

        //add
        const addChapter = async (e) => {
            e.preventDefault()
            if (newChapter.name!=''){

            const postData = {
                userInput: `${newChapter.name}`
            };

            console.log(postData)

            try {
                // Make an asynchronous POST request
                setLoading(true)
                const summary_res = await axios.post(`${apiUrl}/get_ShortNote`, postData);
                console.log(summary_res)

                const modules_res = await axios.post(`${apiUrl}/get_Modules`, postData);
                console.log(modules_res)

                const postDatawithMod = {
                    course_name: `${newChapter.name}`,
                    modules: modules_res.data.topics
                };                    

                const flow_res = await axios.post(`${apiUrl}/get_flowchart`, postDatawithMod);
                console.log(flow_res)

                const glimpse_res = await axios.post(`${apiUrl}/getGlimpse_course`, postData);
                console.log(glimpse_res)



                await addDoc(collection(db, "Course"), {
                    name: newChapter.name,
                    content: summary_res.data,
                    modulesList: modules_res.data,
                    flowchart: flow_res.data,
                    media: glimpse_res.data,

                });
                setNewChapter({ name: '' })
                setLoading(false)

                
              } catch (error) {
                // Handle errors
                console.error('POST request error:', error);
              }

        }
        }


        return (
          <motion.div {...fadeInAnimation}className="w-70 p-4 bg-white rounded-lg shadow-md transform items-center justify-center hover:scale-105 transition-transform duration-300 ease-in-out text-center">
            <div className='w-70 h-full p-12 bg-violet-100 rounded-lg shadow-md'>
            <span className="text-2xl mt-32">Create course</span>
            <div className="mt-4">
            <form className="flex flex-col">
                <input type="text" value={newChapter.name} onChange={(e)=>{ setNewChapter({...newChapter, name: e.target.value})}} placeholder="Enter Course name" className="flex px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent" /> 
                {
                    loading ? <span className="text-blue-500 p-5 text-center mx-auto "><Loader/></span> : <button onClick={addChapter} className="flex px-4 py-2 mt-4 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600">Add</button>
                }
                
              </form>

            </div>
            </div>
          </motion.div>
        );
    }



    //read
    useEffect(() => {
        const q = query(collection(db, "Course"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {

        const chaptersList = []

        querySnapshot.forEach((doc) => {
        chaptersList.push({ ...doc.data(), id: doc.id })
        });
        setChapters(chaptersList)

        return () => unsubscribe()
        });
    }, [])



    return (
        <motion.div className='flex flex-col  mx-auto w-3/4 min-h-screen items-center p-5'>
            <span className='text-5xl font-semibold mt-5'>Start Learning </span>
            {/* courses div */}
            <div className="w-full flex flex-wrap gap-4 justify-center h-auto p-5 mt-12 summary_box bg-gradient-to-r from-violet-200 to-rose-100">
                <CourseAdd/>
                {
                    course.map((item) => (
                        <CourseCard key={item.id} id={item.id} title={item.name} content={item.content} img={item.media}/>
                    ))
                }

            </div>

        </motion.div>
    )
}

export default Courses