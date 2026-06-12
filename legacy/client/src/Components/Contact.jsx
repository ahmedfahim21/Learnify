import React, { useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import { motion } from 'framer-motion';
import { fadeInAnimation } from './animation';

const Contact = () => {
  const form = useRef();
  const [isMessageSent, setMessageSent] = useState(false);

  const sendEmail = (e) => {
    e.preventDefault();

    emailjs
      .sendForm('service_bbuymej', 'template_hcrrx3a', form.current, 'NZwUEA9gdbG0b4EmH')
      .then(
        (result) => {
          console.log(result.text);
          setMessageSent(true); // Set the message sent state to true
        },
        (error) => {
          console.log(error.text);
        }
      );
  };

  return (
    <motion.div {...fadeInAnimation} className='w-3/4 mx-auto flex gap-5 p-5 mb-32'>
      {isMessageSent ? ( // If the message is sent, display a thank you message
        <div className='w-1/2 p-5 flex flex-col min-h-screen'>
          <span className='text-4xl font-semibold'>Thank you for contacting us!</span>
          <span className='text-lg'>
            We have received your message and will get back to you as soon as possible.
          </span>
        </div>
      ) : (
        <div className='flex flex-col gap-2 w-1/2 p-5'>
          <span className='text-4xl font-semibold'>Contact us</span>
          <span className='text-lg'>
            Got any issue or wanna collaborate with us? Contact us through our social media or fill up
            this form, and we will reach out to you ASAP!
          </span>
        </div>
      )}

      {!isMessageSent && ( // If the message is not sent, display the form
        <form
          ref={form}
          onSubmit={sendEmail}
          className='flex flex-col w-1/2 bg-gradient-to-tr gap-2  from-green-100 to-violet-100 summary_box'
        >
          <label>Name</label>
          <input type='text' name='user_name' className='rounded-md p-1 text-sm' placeholder='Enter your name' />
          <label>Email</label>
          <input type='email' name='user_email' className='rounded-md p-1 text-sm' placeholder='Enter your Email' />
          <label>Message</label>
          <textarea name='message' className='rounded-md p-1 text-sm' placeholder='Enter your message!' />
          <input
            type='submit'
            className='pointer mt-5 p-1 bg-gradient-to-r from-violet-200 to-blue-300 hover:from-violet-500 rounded-lg hover:text-white hover:to-blue-500'
            value='Send'
          />
        </form>
      )}
    </motion.div>
  );
};

export default Contact;
