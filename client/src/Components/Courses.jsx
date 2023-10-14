import { useEffect, useState } from 'react'
import { collection, addDoc, onSnapshot, query} from "firebase/firestore"; 
import { db } from '../firebase'
import CourseCard from './Cards/CourseCard'
import axios from 'axios'


function Courses() {

    const apiUrl = 'http://localhost:5000';
    const [course, setChapters] = useState([])


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
                const res = await axios.post(`${apiUrl}/get_ShortNote`, postData);
                console.log(res)

                await addDoc(collection(db, "Course"), {
                    name: newChapter.name,
                    content: res.data,
                });
                setNewChapter({ name: '' })

                
              } catch (error) {
                // Handle errors
                console.error('POST request error:', error);
              }

        }
        }


        return (
          <div className="w-70 p-4 bg-white rounded-lg shadow-md transform items-center justify-center hover:scale-105 transition-transform duration-300 ease-in-out text-center">
            <div className='w-70 h-full p-12 bg-violet-100 rounded-lg shadow-md'>
            <span className="text-2xl mt-32">Create course</span>
            <div className="mt-4">
            <form className="flex flex-col">
                <input type="text" value={newChapter.name} onChange={(e)=>{ setNewChapter({...newChapter, name: e.target.value})}} placeholder="Enter Course name" className="flex px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent" /> 
                {/* <input type="text" value={newChapter.content} onChange={(e)=>{ setNewChapter({...newChapter, content: e.target.value})}} placeholder="Enter content" className="flex px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent" /> */}
                {/* <input type="text" value={newChapter.media} onChange={(e)=>{ setNewChapter({...newChapter, media: e.target.value})}} placeholder="Enter media" className="flex px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent" /> */}
                <button onClick={addChapter} className="flex px-4 py-2 mt-4 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600">Add</button>
              </form>

            </div>
            </div>
          </div>
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
        <div className='flex flex-col  mx-auto w-3/4 min-h-screen items-center p-5'>
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

        </div>
    )
}

export default Courses