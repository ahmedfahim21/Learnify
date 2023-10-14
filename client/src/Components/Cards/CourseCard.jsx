import React from 'react'
import {Link} from 'react-router-dom'
export default function CourseCard({link}) {
    return (
        <Link to={link} class="w-80 p-4 bg-white rounded-lg shadow-md transform hover:scale-105 transition-transform duration-300 ease-in-out">
            <img class="w-full h-40 object-cover rounded-t-lg" alt="Card Image" src="https://via.placeholder.com/150" />
            <div class="p-4">
                <h2 class="text-xl  font-semibold">Beautiful Card</h2>
                <p class="text-gray-600">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam quis ante sit amet tellus ornare tincidunt.</p>
                <div class="flex justify-between items-center mt-4">
                    <Link class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400">Learn More</Link>
                </div>
            </div>
        </Link>
    )
}
