// Using standard fetch API for Groq instead of requiring an SDK
export async function generateChatResponse(
  message: string,
  messageHistory: any[] = []
) {
  try {
    const lowerMessage = message.toLowerCase();

    // Determine if the message is requesting a specific service
    let serviceType = "none";
    let query = "";
    let extractedAppointmentDetails = null;

    // Check for appointment requests and extract date and time if available
    if (
      lowerMessage.includes("appointment") ||
      lowerMessage.includes("schedule") ||
      lowerMessage.includes("book")
    ) {
      serviceType = "appointment";
      extractedAppointmentDetails = extractAppointmentDetails(message);
    } else if (
      lowerMessage.includes("search") ||
      lowerMessage.includes("find information") ||
      lowerMessage.includes("look up")
    ) {
      serviceType = "search";
      query = extractSearchQuery(message);
    } else if (
      lowerMessage.includes("video") ||
      lowerMessage.includes("youtube") ||
      lowerMessage.includes("watch")
    ) {
      serviceType = "video";
      query = extractSearchQuery(message);
    }

    // Prepare conversation history for the Groq API
    const formattedHistory = messageHistory.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add system message
    const systemMessage = {
      role: "system",
      content:
        "You are a helpful medical front desk assistant. Be professional, concise, and friendly. " +
        "Your primary goal is to help patients with their medical queries and tasks.",
    };

    // Prepare the messages for the API request
    const messages = [
      systemMessage,
      ...formattedHistory,
      { role: "user", content: message },
    ];

    // List of models to try in order of preference
    const models = ["llama3-8b-8192", "mixtral-8x7b-32768", "gemma-7b-it"];

    // Try each model until one works
    let response: Response | null = null;
    let currentModelIndex = 0;

    while (response === null && currentModelIndex < models.length) {
      const currentModel = models[currentModelIndex];

      console.log(`Trying Groq model: ${currentModel}`);

      try {
        // Make the API request to Groq
        console.log("Groq API Key:", process.env.GROQ_API_KEY);

        const fetchResponse = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer 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`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: currentModel,
              messages: messages,
              max_tokens: 500,
              temperature: 0.7,
            }),
          }
        );

        // If the response is ok, use it
        if (fetchResponse.ok) {
          response = fetchResponse;
        } else {
          const errorData = await fetchResponse.json();
          console.error(`Error with model ${currentModel}:`, errorData);
        }
      } catch (error) {
        console.error(`Error with model ${currentModel}:`, error);
      }

      currentModelIndex++;
    }

    // If no models worked, throw an error
    if (!response) {
      throw new Error("All Groq models failed to respond");
    }

    const data = await response.json();

    // Extract the response text
    const botResponse =
      data.choices[0].message.content ||
      "I'm sorry, I couldn't process your request.";

    // Prepare service data based on the detected service type
    let serviceData = null;

    if (serviceType === "appointment") {
      serviceData = {
        type: "appointment",
        data: prepareAppointmentData(extractedAppointmentDetails || undefined),
      };
    } else if (serviceType === "search" && query) {
      serviceData = {
        type: "search",
        query,
        data: prepareSearchData(query),
      };
    } else if (serviceType === "video" && query) {
      serviceData = {
        type: "video",
        query,
        data: prepareVideoData(query),
      };
    }

    return {
      message: botResponse,
      service: serviceData,
    };
  } catch (error) {
    console.error("Error generating chat response:", error);
    return {
      message:
        "I apologize, but I'm having trouble processing your request right now. Please try again later.",
      service: null,
    };
  }
}

// Helper function to extract search query from message
function extractSearchQuery(message: string): string {
  // Simple extraction - in a real application this would be more sophisticated
  const commonPhrases = [
    "search for",
    "find information about",
    "look up",
    "tell me about",
    "information on",
    "video about",
    "play a video on",
    "show me",
  ];

  let query = message;

  for (const phrase of commonPhrases) {
    if (message.toLowerCase().includes(phrase)) {
      const parts = message.toLowerCase().split(phrase);
      if (parts.length > 1) {
        query = parts[1].trim();
        break;
      }
    }
  }

  // If query is still the full message, try to extract the key terms
  if (query === message) {
    // Remove question words and common verbs
    const wordsToRemove = [
      "what",
      "where",
      "when",
      "how",
      "why",
      "can",
      "could",
      "would",
      "should",
      "is",
      "are",
      "was",
      "were",
      "you",
      "i",
      "me",
      "my",
      "mine",
      "help",
    ];
    const words = message.toLowerCase().split(/\s+/);
    query = words
      .filter((word) => !wordsToRemove.includes(word))
      .join(" ")
      .trim();
  }

  return query;
}

// Extract appointment details from a message
function extractAppointmentDetails(message: string) {
  const lowerMessage = message.toLowerCase();

  // Extract date information
  let date = null;
  let time = null;
  let type = null;

  // Check for common date patterns
  const todayPattern = /\b(today)\b/i;
  const tomorrowPattern = /\b(tomorrow)\b/i;
  const datePattern =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(st|nd|rd|th)?\b/i;
  const numericDatePattern = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
  const dayPattern =
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;

  // Check for common time patterns
  const timePattern = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const hourPattern = /\b(at|@)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;

  // Extract appointment type
  const typePatterns = [
    {
      pattern: /\b(general|check[-\s]?up|physical|routine|annual)\b/i,
      type: "General Check-up",
    },
    {
      pattern: /\b(specialist|consult|consultation|refer|referral)\b/i,
      type: "Specialist Consultation",
    },
    { pattern: /\b(follow[-\s]?up|checking|monitoring)\b/i, type: "Follow-up" },
    {
      pattern: /\b(vaccine|vaccination|shot|immunization|booster|flu)\b/i,
      type: "Vaccination",
    },
  ];

  // Try to extract date
  if (todayPattern.test(lowerMessage)) {
    const today = new Date();
    date = today.toISOString().split("T")[0];
  } else if (tomorrowPattern.test(lowerMessage)) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = tomorrow.toISOString().split("T")[0];
  } else if (datePattern.test(lowerMessage)) {
    const matches = lowerMessage.match(datePattern);
    if (matches && matches.length >= 3) {
      const month = matches[1];
      const day = parseInt(matches[2]);
      const monthIndex = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ].indexOf(month.toLowerCase());

      if (monthIndex !== -1) {
        const now = new Date();
        const year = now.getFullYear();
        const dateObj = new Date(year, monthIndex, day);

        // If the date is in the past, assume next year
        if (dateObj < now) {
          dateObj.setFullYear(year + 1);
        }

        date = dateObj.toISOString().split("T")[0];
      }
    }
  } else if (dayPattern.test(lowerMessage)) {
    const matches = lowerMessage.match(dayPattern);
    if (matches && matches.length > 1) {
      const targetDay = matches[1].toLowerCase();
      const days = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const targetDayIndex = days.indexOf(targetDay);

      if (targetDayIndex !== -1) {
        const now = new Date();
        const currentDayIndex = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Calculate days to add
        let daysToAdd = targetDayIndex - currentDayIndex;
        if (daysToAdd <= 0) daysToAdd += 7; // Next week

        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + daysToAdd);

        date = targetDate.toISOString().split("T")[0];
      }
    }
  }

  // Try to extract time
  if (timePattern.test(lowerMessage)) {
    const matches = lowerMessage.match(timePattern);
    if (matches && matches.length >= 4) {
      let hour = parseInt(matches[1]);
      const minute = matches[2] ? matches[2] : "00";
      const amPm = matches[3].toLowerCase();

      // Convert to 12-hour format
      if (amPm === "pm" && hour < 12) hour += 12;
      if (amPm === "am" && hour === 12) hour = 0;

      time = `${hour % 12 || 12}:${minute} ${amPm.toUpperCase()}`;
    }
  } else if (hourPattern.test(lowerMessage)) {
    const matches = lowerMessage.match(hourPattern);
    if (matches && matches.length >= 5) {
      let hour = parseInt(matches[2]);
      const minute = matches[3] ? matches[3] : "00";
      const amPm = matches[4]
        ? matches[4].toLowerCase()
        : hour < 12
        ? "am"
        : "pm";

      // Convert to 12-hour format
      if (amPm === "pm" && hour < 12) hour += 12;
      if (amPm === "am" && hour === 12) hour = 0;

      time = `${hour % 12 || 12}:${minute} ${amPm.toUpperCase()}`;
    }
  }

  // Try to extract type
  for (const { pattern, type: appointmentType } of typePatterns) {
    if (pattern.test(lowerMessage)) {
      type = appointmentType;
      break;
    }
  }

  return { date, time, type };
}

// Define the type for appointment data
interface AppointmentData {
  appointmentTypes: string[];
  doctors: string[];
  extractedDetails?: {
    date: string | null;
    time: string | null;
    type: string | null;
  };
}

// Prepare appointment data
function prepareAppointmentData(
  extractedDetails?: {
    date: string | null;
    time: string | null;
    type: string | null;
  } | null
): AppointmentData {
  // For a real application, this would fetch available appointment slots from a database
  const data: AppointmentData = {
    appointmentTypes: [
      "General Check-up",
      "Specialist Consultation",
      "Follow-up",
      "Vaccination",
    ],
    doctors: ["Dr. Smith", "Dr. Johnson", "Dr. Williams", "Dr. Brown"],
  };

  // If we have extracted details, add them to the data
  if (extractedDetails) {
    data.extractedDetails = extractedDetails;
  }

  return data;
}

// Prepare search results data
function prepareSearchData(query: string) {
  // For a real application, this would use a search API
  if (query.includes("diabetes")) {
    return {
      title: "Diabetes Information",
      summary: "Information about diabetes symptoms and management",
      featuredInfo: {
        title: "Common symptoms of diabetes include:",
        content: [
          "Increased thirst and urination",
          "Extreme fatigue",
          "Blurry vision",
          "Cuts/bruises that are slow to heal",
          "Weight loss, even though you are eating more (type 1)",
          "Tingling, pain, or numbness in the hands/feet (type 2)",
        ],
        source: "American Diabetes Association",
      },
      results: [
        {
          title: "Diabetes Symptoms: When to see a doctor | Mayo Clinic",
          url: "https://www.mayoclinic.org/diseases-conditions/diabetes/symptoms-causes/syc-20371444",
          displayUrl:
            "www.mayoclinic.org › diseases-conditions › diabetes › symptoms-causes",
          snippet:
            "Diabetes symptoms vary depending on how much your blood sugar is elevated. Some people, especially those with prediabetes or type 2 diabetes, may not ...",
        },
        {
          title: "Symptoms & Causes of Diabetes | NIDDK",
          url: "https://www.niddk.nih.gov/health-information/diabetes/overview/symptoms-causes",
          displayUrl: "www.niddk.nih.gov › health-information › diabetes",
          snippet:
            "What are the symptoms of diabetes? Symptoms of diabetes include increased thirst and urination, fatigue, and blurred vision. Some people with ...",
        },
        {
          title: "Diabetes Symptoms | CDC",
          url: "https://www.cdc.gov/diabetes/basics/symptoms.html",
          displayUrl: "www.cdc.gov › diabetes › basics › symptoms",
          snippet:
            "Learn about diabetes symptoms such as frequent urination, increased thirst, and unexplained weight loss. Early detection and treatment can prevent ...",
        },
      ],
    };
  } else {
    return {
      title: query,
      summary: `Information about ${query}`,
      results: [
        {
          title: `Medical Information about ${query} | MedlinePlus`,
          url: `https://medlineplus.gov/search?query=${encodeURIComponent(
            query
          )}`,
          displayUrl: `medlineplus.gov › search › ${query.replace(
            /\s+/g,
            "+"
          )}`,
          snippet: `Comprehensive medical information about ${query} including symptoms, treatments, and prevention measures.`,
        },
        {
          title: `${query} - Health Information | Mayo Clinic`,
          url: `https://www.mayoclinic.org/search/search-results?q=${encodeURIComponent(
            query
          )}`,
          displayUrl: `www.mayoclinic.org › search › ${query.replace(
            /\s+/g,
            "+"
          )}`,
          snippet: `Learn about the causes, symptoms, diagnosis & treatment of ${query} from the Mayo Clinic.`,
        },
      ],
    };
  }
}

// Prepare video data
function prepareVideoData(query: string) {
  // For a real application, this would use YouTube API
  return {
    title: `Managing ${query}: Healthy Living Tips`,
    videoId: "dQw4w9WgXcQ", // Example video ID
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    duration: "6:42",
    channel: `${query} Health Association`,
    views: "23K",
    likes: "450",
    description: `This video provides practical tips for managing ${query} through diet, exercise, and lifestyle changes. Learn about prevention, treatment options, and how to live a healthy life.`,
  };
}
