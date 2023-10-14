
import {Link} from 'react-router-dom'
import { deleteDoc, doc } from '@firebase/firestore'
import { db } from '../../firebase'
import imageData from "../../image.json"


export default function CourseCard({id,title,img,content}) {

    //delete
    const deleter = async (id) => {
        // console.log("clicked" + id)
        const res = await  deleteDoc(doc(db, "Course", id));
        console.log(res)
    }

    // console.log(imageData.image)

    return (
        <div  className="w-80 p-4 bg-white rounded-lg shadow-md transform hover:scale-105 transition-transform duration-300 ease-in-out">
            <img className="w-full h-40 object-cover rounded-t-lg" alt="Card Image" src={"data:image/png;base64,"+imageData.image} />
            <div className="p-4">
                <h2 className="text-xl  font-semibold">{title}</h2>
                <p className="text-gray-600">{content}</p>
                <div className="flex justify-between items-center mt-4">
                    <Link to={`/courses/${id}`} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400">Learn More</Link>
                    <button onClick={() => deleter(id)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-red-400">Delete</button>
                </div>
            </div>
        </div>
    )
}
