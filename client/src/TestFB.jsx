import { useEffect, useState } from 'react'
import { collection, addDoc, onSnapshot, query, deleteDoc, doc} from "firebase/firestore"; 
import { db } from './firebase'
import { Link } from "react-router-dom";

export default function TestFB() {

  const [course, setChapters] = useState([])

  const [newChapter, setNewChapter] = useState({ name: '', content: '', media: '' })


//add
  const addChapter = async (e) => {
    e.preventDefault()
    if (newChapter.name!=''){

      await addDoc(collection(db, "Course"), {
        name: newChapter.name,
        content: newChapter.content,
        media: newChapter.media
      });
      setNewChapter({ name: '', content: '', media: '' })
  }
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

//delete
const deleteItem = async (id) => {
  await deleteDoc(doc(db, "Course", id));
}

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full  flex font-mono text-sm mx-auto">
        <h1 className='text-4xl font-bold text-center text-gray-800 dark:text-white lg:text-6xl'>
          Courses
        </h1>
        <div className="flex mx-auto">
          <form className="flex flex-col">
            <input type="text" value={newChapter.name} onChange={(e)=>{ setNewChapter({...newChapter, name: e.target.value})}} placeholder="Enter Course name" className="flex px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent" /> 
            <input type="text" value={newChapter.content} onChange={(e)=>{ setNewChapter({...newChapter, content: e.target.value})}} placeholder="Enter content" className="flex px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent" />
            <input type="text" value={newChapter.media} onChange={(e)=>{ setNewChapter({...newChapter, media: e.target.value})}} placeholder="Enter media" className="flex px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent" />
            <button onClick={addChapter} className="flex px-4 py-2 mt-4 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600">Add</button>
          </form>
          <ul className="flex flex-col ml-4">
            {course.map (item => (
              <li key={item.id} className="flex  px-4 py-2 m-4 bg-gray-100 border border-gray-300 rounded-md">
                <span className='flex'>{item.name}</span>
                <br/>
                <span className='flex ml-2'>{item.content}</span>
                <Link to={`/testFb/${item.id}`} className="flex px-4 py-2 m-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:bg-blue-600">Visit</Link>
                <button onClick={() => deleteItem(item.id)} className="flex px-4 py-2 m-2 text-white bg-red-500 rounded-md hover:bg-red-600 focus:outline-none focus:bg-red-600">Delete</button>
              </li>
            ))}
          </ul>

          </div>
      </div>
    </main>
  )
}
