

function Footer() {
  return (
    <div className="w-3/4 p-8 bg-violet-300 flex justify-around mx-auto ">
      <div>
        <span className="text-3xl">Learnify.ai</span>
      </div>
      <div className="flex-col flex gap-2">
        <span className="text-xl">About</span>
        <span className="text-xl">Contact Us</span>
        <span className="text-xl">Team</span>
        
      </div>
      <div className="flex flex-col gap-2"> 
        <span className="text-xl">Terms & Conditions</span>
        <span className="text-xl">Privacy Policy</span>
        <span className="text-xl">FAQ</span>

      </div>
     

    </div>
  )
}

export default Footer