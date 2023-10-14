import { useState } from "react"
import { onSnapshot,doc} from "firebase/firestore";
import { db } from './firebase'
import {Link} from 'react-router-dom'
import { useParams } from "react-router";

function TestFBID() {

    let courseId = useParams();


    const [item, setItem] = useState({})

    //read from firestore by id
    onSnapshot(doc(db, "Course", courseId.id), (doc) => {
        setItem(doc.data())
    });

  return (
    <div>
            <p>CourseTitle {item.name}</p>
            <br />
            <p>CourseContent {item.content}</p>
            <br />
            <p>CourseMedia {item.media}</p>

            <Link to="/courses" className="text-blue-500 hover:text-blue-800"> Back to home</Link>

    </div>
  )
}

export default TestFBID