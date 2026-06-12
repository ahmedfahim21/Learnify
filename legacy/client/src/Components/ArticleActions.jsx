import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fadeInAnimation } from "./animation";
import whatsappIcon from "../assets/whatsapp.png";
import sound from "../assets/sound.gif";
import mute from "../assets/mute.gif";
import axios from "axios";
import { copy, tick } from "../assets";
import PDFDownloadButton from "../Buttons/PDFDownloadButton";
const ArticleActions = ({
  articleSummary,
  link,
  translatedSummary,
  setTranslatedSummary,
}) => {
  const [initialSummary, setInitialSummary] = useState("");
  console.log("initialSummary", initialSummary);
  console.log("articleSummary", articleSummary);
  // const [translatedSummary, setTranslatedSummary] = useState("");
  const [languages, setLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  useEffect(() => {
    // Function to fetch available languages
    const fetchLanguages = async () => {
      console.log("Fetching Languages...");

      const options = {
        method: "GET",
        url: "https://text-translator2.p.rapidapi.com/getLanguages",
        headers: {
          "X-RapidAPI-Key":
            "edd45db06bmsh69c35dcdc4819b6p1cb005jsnce5dacd04037",
          //edd45db06bmsh69c35dcdc4819b6p1cb005jsnce5dacd04037
          // 6d90c4ceefmsh2a38b0206a4488ep141773jsn534665224174
          "X-RapidAPI-Host": "text-translator2.p.rapidapi.com",
        },
      };
      try {
        const response = await axios.request(options);
        console.log("Fetched Languages:", response.data.data.languages);
        setLanguages(response.data.data.languages);
      } catch (error) {
        // console.log(response)
        console.error("Error fetching languages:", error);
      }
    };

    // Call the fetchLanguages function when the component mounts
    fetchLanguages();
  }, []);
  const handleLanguageChange = (e) => {
    console.log("Selected Language:", e.target.value);
    setSelectedLanguage(e.target.value);
  };

  // Function to speak the translated text using web Speech API
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakText = (text) => {
    try {
      const speechSynthesis = window.speechSynthesis;

      //TTS is already speaking then stop it
      if (isSpeaking) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);

      utterance.rate = 1; // Speech rate (0.1 to 10)
      utterance.pitch = 1; // Speech pitch (0 to 2)

      // Speak the text
      speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    } catch (err) {
      alert("Sorry, your browser does not support text to speech");
      console.log(err);
    }
  };
  // Function to handle copy action
  const handleCopy = () => {
    handleSumCopy(articleSummary);
    setSumCopy(articleSummary);
  };

  const createWhatsAppShareLink = () => {
    const text = `Check out this article summary: ${article.summary}`;
    const encodedText = encodeURIComponent(text);
    return `https://api.whatsapp.com/send?text=${encodedText}`;
  };

  // Function to handle sharing to WhatsApp
  const handleShareWhatsApp = () => {
    const shareLink = createWhatsAppShareLink();
    window.open(shareLink, "_blank");
  };

  const [sumcopy, setSumCopy] = useState("");
  const handleSumCopy = (copySum) => {
    setSumCopy(copySum);
    navigator.clipboard.writeText(copySum);
    setTimeout(() => setSumCopy(false), 3000);
  };

  // // Function to handle translation
  // Function to handle translation
  const handleTranslation = async () => {
    const encodedParams = new URLSearchParams();
    encodedParams.set("source_language", "en");
    function extractTextBetweenParentheses(str) {
      const regex = /\((.*?)\)/g;
      const matches = str.match(regex);
      if (matches && matches.length > 0) {
        return matches.map((match) => match.slice(1, -1));
      } else {
        return [];
      }
    }
    const keywords = extractTextBetweenParentheses(selectedLanguage);
    console.log("Keywords:", keywords[0]);
    encodedParams.set("target_language", keywords[0]);
    console.log("Article summary:", articleSummary);
    console.log("Initial summary:", initialSummary);
    encodedParams.set("text", articleSummary);

    const options = {
      method: "POST",
      url: "https://text-translator2.p.rapidapi.com/translate",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "X-RapidAPI-Key": "edd45db06bmsh69c35dcdc4819b6p1cb005jsnce5dacd04037",
        "X-RapidAPI-Host": "text-translator2.p.rapidapi.com",
      },
      data: encodedParams,
    };
    console.log("Translating summary...");
    console.log("Translation options:", options);
    // console.log(initialSummary)
    console.log(selectedLanguage);

    try {
      const response = await axios.request(options);
      // console.log("Translation response:", response.data);
      // console.log("TranslatedText:", response.data.data.translatedText);
      setInitialSummary(response.data.data.translatedText);
      // console.log("Translated summary:", response.data.translatedText);
      // // const translatedText = response.data.translatedText;
      console.log("Translation succesfull");
      setTranslatedSummary(response.data.data.translatedText);
    } catch (error) {
      console.error("Error translating summary:", error);
      console.log("Error response:", error.response);
      setTranslatedSummary("Error occurred while translating the summary.");
    }
  };

  return (
    <>
      <motion.div
        className="flex items-center justify-between p-4 summary_box w-full flex-col md:flex-row gap-3 lg:gap-0 "
        {...fadeInAnimation}
      >
        <div className="flex  items-center md:gap-2">
          {/* Display available languages drop down */}
          <div className="flex justify-center items-center ">
            {languages.length > 0 ? ( // Conditionally render the select element when languages are available
              <div className="flex items-center justify-between gap-2 w-fit">
                <label
                  htmlFor="languages"
                  className="font-satoshi font-bold text-gray-600"
                >
                  {" "}
                </label>
                <span className="font-semibold font-satoshi">
                  Select Language
                </span>
                <select
                  id="languages"
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  className="sm:w-20  w-32 flex bg-blue-500 border rounded-md  text-white p-1"
                >
                  {languages.map((language) => (
                    <option
                      className="bg-blue-200 text-black "
                      key={language.language}
                      value={language.language}
                    >
                      {language.name + " (" + language.code + ")"}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div class="flex flex-col  items-center justify-center m-2 mb-3 md:gap-3 font-satoshi  md:mr-3 ">
                <span className="font-semibold ">Select Language</span>
                <div class="loader2"></div>
              </div>
            )}
            {/* </div> */}
          </div>
          <button
            onClick={handleTranslation}
            className="  sm:w-16 text-center md:w-auto p-1 border rounded-md bg-blue-500 text-white"
          >
            Translate
          </button>
        </div>

        <div className="flex items-center gap-2  ">
          {/* TTS button */}
          <button onClick={() => speakText(articleSummary)}>
            <img
              src={isSpeaking ? mute : sound}
              className=" w-9 h-9 speaker mix-blend-multiply"
              alt=""
            />
          </button>

          {/* Copy button */}
          <button
            className="w-8 h-8 bg-slate-200 flex items-center justify-center rounded-full"
            onClick={handleCopy}
          >
            <img
              src={sumcopy === articleSummary ? tick : copy}
              alt={sumcopy === articleSummary ? "tick_icon" : "copy_icon"}
              className="w-[50%] h-[50%] object-contain"
            />
          </button>
          <PDFDownloadButton summary={articleSummary} link={link} />
          {/* WhatsApp button */}
          <button className="w-9 h-9" onClick={handleShareWhatsApp}>
            <img src={whatsappIcon} alt="whatsapp_icon" />
          </button>
        </div>
      </motion.div>
      <div className="summary_box mt-2 text-sm " id="translated-text-box" placeholder="Translated text will apear here" pla>{translatedSummary}</div>
    </>
  );
};

export default ArticleActions;