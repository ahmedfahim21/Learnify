export const pageAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.5 },
  };
  
  export const slideRightAnimation = {
    initial: { x: "0%", opacity: 0.8, scale: 0.6 },
    animate: { x: 0, opacity: 1, scale: 1 },
    exit: { x: "100%" , opacity: 0},
    transition: { duration: 0.5, ease: "easeIn" },
  };
  
  export const slideLeftAnimation = {
    initial: { x: "100%", opacity: 0.8 },
    animate: { x: 0 , opacity: 1, scale: 1},
    exit: { x: "-100%" },
    transition: { duration: 0.5, ease: "easeInOut" },
  };
  
  export const fadeInAnimation = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.5 },
  };
  
  export const fadeOutAnimation = {
    initial: { opacity: 1 },
    animate: { opacity: 0 },
    exit: { opacity: 1 },
    transition: { duration: 0.5 },
  };
  