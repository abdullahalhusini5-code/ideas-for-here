/* Ideas for Here — idea catalog.
 * Every entry carries provenance in `kit`: a free data source (public-apis),
 * a pattern to crib (awesome-llm-apps), a starter prompt (prompts.chat),
 * and a free way to publish (free-for-dev).
 * No network calls at runtime; this file is the whole database.
 */

const AREAS = [
  { id: "food",     label: "Food & garden",  colour: "#7A6A33" },
  { id: "money",    label: "Money & bills",  colour: "#3F5B43" },
  { id: "home",     label: "Home & things",  colour: "#8C5A3B" },
  { id: "family",   label: "Family & kids",  colour: "#9A4A5C" },
  { id: "health",   label: "Health",         colour: "#3D6273" },
  { id: "learning", label: "Learning",       colour: "#5B4C7A" },
  { id: "community",label: "Community",      colour: "#2F6B5F" },
  { id: "work",     label: "Work & business",colour: "#A0522D" }
];

const TIMES = [
  { id: "weekend", label: "one weekend" },
  { id: "evenings", label: "a few evenings" },
  { id: "month",   label: "a month of Sundays" }
];

const LANES = [
  { id: "ready",     label: "ready-made tools, no code" },
  { id: "assistant", label: "building it with an AI assistant" },
  { id: "code",      label: "writing the code yourself" }
];

const IDEAS = [
  {
    id: "garden-calendar",
    title: "Your garden, month by month",
    tagline: "A planting calendar that knows your weather.",
    describe: "Tell it where you live and what you want to grow. It turns that into a calendar of real jobs — sow this now, water twice a week, pick before the heat — instead of a generic guide written for another country.",
    area: "food", goals: ["ease", "learn"], minutes: "weekend", lanes: ["ready", "assistant", "code"],
    needs: ["A phone or laptop", "Your city name"],
    steps: [
      "Write down the ten things your household actually eats.",
      "Get the local weather for the next three months and mark the hot and cold weeks.",
      "Match each crop to a planting window and a watering rhythm.",
      "Print it, stick it on the fridge, and adjust it after the first month."
    ],
    kit: {
      data: ["Open-Meteo", "https://open-meteo.com/", "Free weather, no key required"],
      pattern: ["rag_chain", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/rag_chain", "Ask questions over your own notes"],
      prompt: ["Backyard Vegetable Garden Season Plan", "https://prompts.chat/prompts/cmw4no9ik0001l907r3f8o56k", "prompts.chat · Productivity"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "fridge-recipes",
    title: "Cook what you already have",
    tagline: "Type what's in the fridge, get tonight's dinner.",
    describe: "Most food gets thrown out because nobody can think of a meal at seven in the evening. List what's in the fridge and cupboard, and get three things you can cook tonight with steps short enough to follow while tired.",
    area: "food", goals: ["ease"], minutes: "weekend", lanes: ["ready", "assistant"],
    needs: ["A phone", "A list of what's in the kitchen"],
    steps: [
      "Keep a running list of what's in the fridge — one line each.",
      "Add the things that always fail: allergies, no oven, twenty minutes max.",
      "Ask for three meals using only what's on the list.",
      "Save the ones the family actually ate; they become the default rotation."
    ],
    kit: {
      pattern: ["rag_chain", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/rag_chain", "Answer from a small private list, not the whole internet"],
      publish: ["Neocities", "https://neocities.org", "Free static site, 1 GB"]
    }
  },
  {
    id: "market-prices",
    title: "What things cost this week",
    tagline: "Twenty prices, tracked until the pattern shows.",
    describe: "Pick the twenty things you buy every week — eggs, oil, chicken, tomatoes. Note the price each time you shop. After a month you can see what is creeping up, which shop is cheaper, and where the money actually goes.",
    area: "money", goals: ["ease", "earn"], minutes: "weekend", lanes: ["ready", "assistant", "code"],
    needs: ["A phone", "A notebook, or a spreadsheet"],
    steps: [
      "List twenty staples and the shop you buy each one from.",
      "Write the price and the date, every shop, for four weeks.",
      "Chart each item as a single line — the jump will be obvious.",
      "Share the shortlist of 'buy this here, that there' with family."
    ],
    kit: {
      pattern: ["ai_data_visualisation_agent", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/starter_ai_agents/ai_data_visualisation_agent", "Turn a plain table into charts"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "bread-coach",
    title: "A patient baking coach",
    tagline: "For the recipe you keep failing at.",
    describe: "Sourdough, pastries, bread — the kind of thing where the recipe assumes you already know what 'until it looks right' means. A coach that answers the one question you have right now, with photos, and never makes you feel stupid.",
    area: "food", goals: ["learn", "ease"], minutes: "evenings", lanes: ["ready", "assistant"],
    needs: ["A phone", "Flour and patience"],
    steps: [
      "Pick one recipe and make it badly once, on purpose.",
      "Write down exactly where it went wrong — the dough, the oven, the timing.",
      "Build a page of the five questions you always have, with photos of each stage.",
      "Test it on someone else who has never baked; fix the part they got stuck on."
    ],
    kit: {
      prompt: ["Act as a Beginner Sourdough Starter Coach", "https://prompts.chat/prompts/cmvt7lvcj0001lb07dz57asgv", "prompts.chat · Learning & Skills"],
      pattern: ["vision_rag", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/vision_rag", "Answer questions about photos"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "gift-budget",
    title: "Never overspend on a celebration again",
    tagline: "Weddings, Eid, Christmas, birthdays — one budget.",
    describe: "Plan a celebration properly: who you're buying for, a limit per person, what's already bought, and what's left. It adds up as you go and warns you while there's still time to change your mind, not afterwards.",
    area: "money", goals: ["ease"], minutes: "weekend", lanes: ["ready", "assistant"],
    needs: ["A phone", "The guest list"],
    steps: [
      "Write the list of people and a limit for each.",
      "Add what you've already bought and what it cost.",
      "Watch the running total against the limit, not the wish list.",
      "Keep it for next year — most of the list is the same."
    ],
    kit: {
      prompt: ["Holiday Gift Plan and Budget Builder", "https://prompts.chat/prompts/cmvyx8mbl0001jq08a6j152fn", "prompts.chat · Productivity"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "bill-split",
    title: "Who owes what at home",
    tagline: "One list, no group-chat argument.",
    describe: "Rent, electricity, internet, water, the man who fixes the boiler. Everyone in the flat or the family sees what's paid, what's late, and who owes what — settled with a screenshot instead of a three-day conversation.",
    area: "money", goals: ["ease"], minutes: "evenings", lanes: ["ready", "assistant"],
    needs: ["A phone each", "The bills"],
    steps: [
      "List every recurring bill, its amount, and its due date.",
      "Split each one by whatever rule your household actually uses.",
      "Show one total per person and one 'paid' tick per bill.",
      "Send a reminder three days before, not the day after."
    ],
    kit: {
      pattern: ["ai_data_analysis_agent", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/starter_ai_agents/ai_data_analysis_agent", "Sums and reminders over a small table"],
      publish: ["Vercel", "https://vercel.com/", "Free hobby tier"]
    }
  },
  {
    id: "two-currencies",
    title: "Prices in the money you think in",
    tagline: "Earn in one currency, spend in another.",
    describe: "A shopping list that shows every price in both currencies at today's rate, with both totals. For people sending money home, working abroad, or budgeting for a trip — so the number on the shelf stops being a riddle.",
    area: "money", goals: ["ease"], minutes: "weekend", lanes: ["ready", "code"],
    needs: ["A phone", "Internet for the rate"],
    steps: [
      "Pick the two currencies and the day's rate.",
      "Enter prices as you shop; show both amounts side by side.",
      "Show the running total in both, and the difference from last week.",
      "Keep the last rate on the phone so it still works when the signal drops."
    ],
    kit: {
      data: ["Frankfurter", "https://frankfurter.dev", "Keyless daily rates, no signup"],
      data2: ["Currency-api", "https://github.com/fawazahmed0/currency-api#readme", "150+ currencies, no rate limits"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "renovation-tracker",
    title: "A renovation that stays on budget",
    tagline: "Kitchen, bathroom, or one wall of paint.",
    describe: "Plan the job in the order it actually happens: what gets ripped out, what gets bought, who does which part, how long each waits for the other. A running total and photos at each stage, so problems show up early instead of on the last day.",
    area: "home", goals: ["ease"], minutes: "month", lanes: ["ready", "assistant"],
    needs: ["A phone", "Photos of the room as it is"],
    steps: [
      "Photograph the room and write down what's wrong with it.",
      "List the stages in order and what has to be bought before each one.",
      "Add who does each stage and how many days it takes.",
      "Photograph after every stage; the photos are your proof when something fails."
    ],
    kit: {
      prompt: ["Kitchen Remodel Timeline and Budget Plan", "https://prompts.chat/prompts/cmw1s8u2t0004lc08yt2srpzf", "prompts.chat · Productivity"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "warranty-vault",
    title: "Receipts and warranties that don't vanish",
    tagline: "Photograph it once, forget it safely.",
    describe: "Photograph a receipt and it remembers what you bought, where, how long the warranty lasts, and reminds you a week before it ends. No more drawers of faded paper, and no more paying for a repair that was still covered.",
    area: "home", goals: ["ease"], minutes: "weekend", lanes: ["assistant", "ready"],
    needs: ["A phone camera", "A folder for photos"],
    steps: [
      "Photograph every receipt for a month.",
      "Record item, shop, date, price and warranty length.",
      "Sort by the date the warranty ends, not the date you bought it.",
      "Set one reminder a week before each expiry."
    ],
    kit: {
      pattern: ["vision_rag", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/rag_tutorials/vision_rag", "Read text out of photos"],
      publish: ["Neocities", "https://neocities.org", "Free static site"]
    }
  },
  {
    id: "meter-reader",
    title: "Where your water and power go",
    tagline: "One number a week, and the bill stops being a surprise.",
    describe: "Type the number off the meter once a week. It draws the line, shows your worst week, and tells you when a bill doesn't match what you actually used — before you pay it.",
    area: "home", goals: ["ease"], minutes: "weekend", lanes: ["ready", "assistant", "code"],
    needs: ["A phone", "Access to the meter"],
    steps: [
      "Find the meter and photograph where the number sits.",
      "Enter the reading on the same day each week.",
      "Compare the change to last month and to last year.",
      "When a bill arrives, check it against the readings before paying."
    ],
    kit: {
      pattern: ["ai_data_visualisation_agent", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/starter_ai_agents/ai_data_visualisation_agent", "Charts from a handful of numbers"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "car-service",
    title: "Car care without the guesswork",
    tagline: "Service history, renewals, and the tyre that's been low for months.",
    describe: "Everything about the car in one place: oil changes, tyres, registration renewal, the mechanic's number. Reminders arrive early enough to book something, instead of the morning the paper expires.",
    area: "home", goals: ["ease"], minutes: "weekend", lanes: ["ready"],
    needs: ["A phone", "The car's papers"],
    steps: [
      "Write down make, model, year and plate.",
      "Add past services with dates and mileage.",
      "Add renewals and the date each one expires.",
      "Set reminders thirty days before, not on the day."
    ],
    kit: {
      prompt: ["Car Maintenance Service Schedule Planner", "https://prompts.chat/prompts/cmw1sug0t0007ku08xff10plv", "prompts.chat · Agent Skill"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "family-trip",
    title: "Plan the family trip once",
    tagline: "One plan everyone can actually see.",
    describe: "Dates, budget, who's driving, where you stop, what to pack. Everyone gets the same plan on their phone, the packing list ticks itself off, and nobody asks 'what time are we leaving?' for the ninth time.",
    area: "family", goals: ["ease"], minutes: "weekend", lanes: ["ready", "assistant"],
    needs: ["A phone each", "Dates and a budget"],
    steps: [
      "Agree the dates and the total you're willing to spend.",
      "List the stops in order with driving times between them.",
      "Build one packing list per person, shared, tickable.",
      "Send the same link to everyone and keep it as the single truth."
    ],
    kit: {
      prompt: ["Family Road Trip Plan and Packing List", "https://prompts.chat/prompts/cmw37wpc50001jw08q0ua8hu1", "prompts.chat · Productivity"],
      prompt2: ["Family Camping Weekend Plan Builder", "https://prompts.chat/prompts/cmvt7rii70009lb07a9gjqzzw", "prompts.chat · Productivity"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "weekend-kids",
    title: "What do we do with the kids this weekend?",
    tagline: "Cheap and nearby, filtered by age and patience.",
    describe: "A short list of free or cheap things happening around you, filtered by the children's ages and how far you're willing to drive. Updated on Thursday evening, when the question is actually asked.",
    area: "family", goals: ["ease", "help"], minutes: "evenings", lanes: ["assistant", "ready"],
    needs: ["A phone", "A list of local places"],
    steps: [
      "Collect the places: parks, libraries, playgrounds, free museum days.",
      "Tag each with age range, cost, and drive time.",
      "Pick five for the weekend and say why each one fits.",
      "Add what you actually went to; drop the ones that disappointed."
    ],
    kit: {
      pattern: ["ai_travel_agent", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/starter_ai_agents/ai_travel_agent", "Suggests options from a fixed list, not from thin air"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "school-deadlines",
    title: "No more missed school forms",
    tagline: "Every trip, exam, fee and permission slip, in one place.",
    describe: "Each child's school dates in one list you export to the phone's calendar once — so the reminders become the phone's job and the paperwork stays yours. Photograph the letter that came home in the bag and it goes where it belongs.",
    area: "family", goals: ["ease"], minutes: "weekend", lanes: ["ready"],
    needs: ["A phone", "The letters from school", "The phone's calendar app"],
    steps: [
      "Collect every paper that came home this term.",
      "Add each date, what it needs, and how much it costs.",
      "Export the whole list to the phone calendar in one go — that's where the reminders live.",
      "Share the calendar with whoever does the school run."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "chores-allowance",
    title: "Chores and pocket money, settled",
    tagline: "The board does the arguing.",
    describe: "A simple board where each child ticks off their jobs, watches the total grow, and sees how close they are to whatever they're saving for. Removes the weekly negotiation from your evening.",
    area: "family", goals: ["ease", "learn"], minutes: "weekend", lanes: ["ready", "assistant"],
    needs: ["A phone or tablet", "A savings goal per child"],
    steps: [
      "List the jobs and what each is worth.",
      "Give each child a goal with a price, so saving has a point.",
      "Tick the jobs off together at the end of the day.",
      "Pay out on a fixed day, every time, no exceptions."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "medicine-reminder",
    title: "Medicine reminders that survive a bad day",
    tagline: "For a parent who isn't on the phone all day.",
    describe: "A tablet left on the kitchen counter showing today's doses in huge type, with one button to confirm each. The phone's own alarm does the reminding — this makes the record readable to whoever is checking in.",
    area: "health", goals: ["help", "ease"], minutes: "weekend", lanes: ["ready"],
    needs: ["A cheap tablet", "The prescription list", "A phone alarm for each dose"],
    steps: [
      "List each medicine, dose and time — with the actual pill in front of you.",
      "Set one alarm per dose on the phone itself. That's what actually reminds.",
      "Make the tablet screen show today's doses with one enormous button each.",
      "Test it with the person who'll use it, and follow their words, not yours."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "walking-habit",
    title: "Ten thousand steps, without the guilt",
    tagline: "One route, honestly tracked.",
    describe: "Pick a route near home, count how often you actually walk it, and see the month at a glance. No streaks to break, no subscription, no shame — just the truth, which turns out to be motivating enough.",
    area: "health", goals: ["ease", "learn"], minutes: "weekend", lanes: ["ready", "assistant"],
    needs: ["A phone", "A route you like"],
    steps: [
      "Walk three routes and time them.",
      "Pick the one you'd do on a bad day, not the best day.",
      "Mark each walk with one tap — that's the whole interface.",
      "Look at the month on the first of the next one."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "appointment-log",
    title: "Every appointment in one place",
    tagline: "So you can answer 'when did this start?'",
    describe: "Doctor, dentist, lab results, prescriptions. Who you saw, what they said, what happens next. Five minutes after each visit saves an hour of reconstruction at the next one — and stops you repeating the same tests.",
    area: "health", goals: ["ease", "help"], minutes: "weekend", lanes: ["ready"],
    needs: ["A phone", "The last few prescriptions"],
    steps: [
      "Add the last six months of visits from memory and paperwork.",
      "For each: date, who, what was said, what's next.",
      "Photograph prescriptions and lab sheets into the same entry.",
      "Before the next visit, read the previous entry out loud."
    ],
    kit: {
      publish: ["Neocities", "https://neocities.org", "Free static site"]
    }
  },
  {
    id: "exam-plan",
    title: "A study plan that survives real life",
    tagline: "Short sittings, and a plan that moves when you miss a day.",
    describe: "Enter the exam date and the chapters. It splits the work into sittings short enough to actually start, then reshuffles the remaining days when life gets in the way instead of collapsing.",
    area: "learning", goals: ["learn", "ease"], minutes: "evenings", lanes: ["ready", "assistant", "code"],
    needs: ["A phone", "The syllabus"],
    steps: [
      "List the chapters and estimate how long each really takes.",
      "Divide into twenty-five minute sittings with a real break.",
      "Mark each sitting done, and let missed ones move, never vanish.",
      "Do one full past paper a week before the date."
    ],
    kit: {
      prompt: ["Reading Plan and Page Pace Planner", "https://prompts.chat/prompts/cmw0db2u9000aju08cbridbtw", "prompts.chat · Agent Skill"],
      prompt2: ["Study Abroad Departure Countdown Plan", "https://prompts.chat/prompts/cmvqcnxkm0009lc08qcb67mok", "prompts.chat · Education"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "english-practice",
    title: "Someone to practise English with",
    tagline: "Five minutes a day, out loud, without embarrassment.",
    describe: "Speak for five minutes about ordinary things — ordering food, a job interview, a phone call to the bank — and get a gentle correction on the two things that matter most. Practising with a machine is easier than practising with a person who might laugh.",
    area: "learning", goals: ["learn"], minutes: "evenings", lanes: ["assistant"],
    needs: ["A phone with a microphone", "Five quiet minutes"],
    steps: [
      "Pick five situations you actually avoid because of the language.",
      "Write one short scene for each.",
      "Speak the scene out loud and get two corrections, no more.",
      "Repeat the same scene in a week; notice it got easier."
    ],
    kit: {
      pattern: ["voice_ai_agents", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/voice_ai_agents", "Talking apps rather than typing"],
      publish: ["Render", "https://render.com", "Free tier for a small server"]
    }
  },
  {
    id: "hobby-coach",
    title: "A beginner's coach for the thing you keep postponing",
    tagline: "Chess, ukulele, sewing, swimming — twenty minutes at a time.",
    describe: "Instead of a hundred videos and no order, one small next step, checked. It notices what you got wrong last time and builds the next session around it, the way a patient teacher would.",
    area: "learning", goals: ["learn"], minutes: "evenings", lanes: ["assistant", "ready"],
    needs: ["A phone", "The instrument, board, or kit"],
    steps: [
      "Write the one thing you want to be able to do in a month.",
      "Break it into twenty-minute sessions that each end with something finished.",
      "Record each session and ask what went wrong, specifically.",
      "Re-test the first thing you learned every two weeks."
    ],
    kit: {
      prompt: ["Act as a Beginner Chess Opening Coach", "https://prompts.chat/prompts/cmvw2hu5m0004jj08e1g8ekit", "prompts.chat · Learning & Skills"],
      prompt2: ["Act as a Beginner Ukulele Coach", "https://prompts.chat/prompts/cmw1s5icd0004l908gqkahzv3", "prompts.chat · Learning & Skills"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "skill-swap",
    title: "Teach one thing, learn another",
    tagline: "A swap board for your neighbourhood.",
    describe: "A board where someone posts 'I can fix bikes, I want to learn to cook' and gets matched with the person next door who wants the opposite. No money changes hands, and the neighbourhood gets a little less anonymous.",
    area: "learning", goals: ["help", "learn"], minutes: "evenings", lanes: ["ready"],
    needs: ["A phone each", "A place to meet"],
    steps: [
      "Ask twenty neighbours for one thing they can teach and one they want.",
      "Write each as a pair, in their own words.",
      "Match opposites, and introduce them with one message.",
      "Keep a public list of what worked, so the next match is easier."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "lost-found",
    title: "Lost and found for your street",
    tagline: "Keys, a school bag, a cat.",
    describe: "A page of things found on the street — keys, a school bag, a cat — that you link once in the building group. People claim by describing something that isn't in the photo, and the post comes down when it's returned.",
    area: "community", goals: ["help"], minutes: "weekend", lanes: ["ready"],
    needs: ["A phone", "A place to leave found items"],
    steps: [
      "Agree one safe place where found things are kept.",
      "Post a photo, the place, and the date — never the full address.",
      "Let people claim by describing something not visible in the photo.",
      "Delete the post when it's returned."
    ],
    kit: {
      data: ["Formlane", "https://smallwerk.com/formlane", "Free form backend for static sites, 250/month"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "building-board",
    title: "The building noticeboard, but readable",
    tagline: "Water cuts, repairs, rules, meetings.",
    describe: "One place for the things a building actually needs to tell everyone: when the water is off, which lift is broken, what changed about parking. Sorted by date, written in plain language, and the caretaker can post in seconds.",
    area: "community", goals: ["help", "ease"], minutes: "weekend", lanes: ["ready"],
    needs: ["A phone", "The caretaker's agreement"],
    steps: [
      "Ask the caretaker what he repeats most often by voice.",
      "Turn the five most common messages into fixed templates.",
      "Post each with a date and an expiry — old notices disappear by themselves.",
      "Print a QR code for the entrance."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "outage-map",
    title: "Is the water out on your street too?",
    tagline: "One tap, one message to the group, no phone numbers exposed.",
    describe: "Two buttons: water, power. Tap one and it opens WhatsApp with the message already written — the street, the time, how long it's been off. The record builds itself in the group chat, and the next person can see instantly whether it's just them.",
    area: "community", goals: ["help", "ease"], minutes: "weekend", lanes: ["ready", "code"],
    needs: ["A phone", "A building or street group chat"],
    steps: [
      "Pick two buttons: water, power — nothing else.",
      "Write one message template with the street and the time filled in.",
      "Make each button open WhatsApp with that message ready to send.",
      "Pin the page in the group so it's one tap away the next time something goes."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "pothole-report",
    title: "Report it once, properly",
    tagline: "A pothole, a broken light, dumped rubbish.",
    describe: "Photograph the problem and it records the location and date and writes the message to whoever is responsible, in the form they expect. Keeps a record, so 'we already reported it' becomes a fact instead of a memory.",
    area: "community", goals: ["help"], minutes: "weekend", lanes: ["assistant"],
    needs: ["A phone with a camera", "The right office's email"],
    steps: [
      "Find the office that actually handles this, and how they take reports.",
      "Write the message template once, with placeholders.",
      "Attach photo, date and location automatically.",
      "Log every report so you can follow up in two weeks."
    ],
    kit: {
      pattern: ["web_scraping_ai_agent", "https://github.com/Shubhamsaboo/awesome-llm-apps/tree/main/starter_ai_agents/web_scraping_ai_agent", "Fetch and fill forms from a page"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "volunteer-shifts",
    title: "Fill the volunteer rota without twenty phone calls",
    tagline: "For the centre, the mosque, the school.",
    describe: "The organisation posts the shifts it needs, and people claim one through a short form. You get an email per claim and update the page once. Replaces the group chat where the same four people always end up doing everything.",
    area: "community", goals: ["help"], minutes: "weekend", lanes: ["ready"],
    needs: ["A phone each", "The list of shifts"],
    steps: [
      "List the shifts for one month, with times and how many people each needs.",
      "Put a short claim form on the page — name, shift, phone.",
      "Update the page once a day and show what's still empty; visible gaps get filled.",
      "Thank people by name afterwards; that's what brings them back."
    ],
    kit: {
      data: ["Formlane", "https://smallwerk.com/formlane", "Free form backend, emails you each claim"],
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "trade-invoice",
    title: "Invoices for people who fix things",
    tagline: "A plumber, electrician or painter, on their phone.",
    describe: "Make a proper quote or invoice in two minutes, send it on WhatsApp, and keep a record of who paid. Turns a paper notebook and a vague memory into something you can show the tax office or a customer who 'never received' it.",
    area: "work", goals: ["earn"], minutes: "weekend", lanes: ["ready", "assistant"],
    needs: ["A phone", "Your prices"],
    steps: [
      "List your ten usual jobs and what you charge.",
      "Make one screen: customer, job, parts, total.",
      "Send as a clean PDF or a link; keep the copy.",
      "Mark paid or unpaid, and who owes you from last month."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "home-baker-catalog",
    title: "A price list that updates itself",
    tagline: "For home bakers and cooks.",
    describe: "Photograph today's cakes, set the prices, and share one link. Orders arrive as a list instead of scattered across five chats and a phone that never stops ringing — and yesterday's sold-out cake disappears from the page.",
    area: "work", goals: ["earn"], minutes: "weekend", lanes: ["ready"],
    needs: ["A phone", "Photos of what you make"],
    steps: [
      "Photograph five things you make, on a clean background.",
      "Set one price each and how much notice you need.",
      "Publish one page with a WhatsApp order button.",
      "Turn items off when sold out — that's the whole trick."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "first-cv",
    title: "A first CV when you have no experience",
    tagline: "School, volunteering, odd jobs — it counts.",
    describe: "Answer simple questions about school, volunteering and the jobs nobody called jobs. It turns them into a clean one-page CV and a short message you can send to an employer, in the format people here actually read.",
    area: "work", goals: ["earn", "learn"], minutes: "evenings", lanes: ["assistant"],
    needs: ["A phone", "A list of what you've done"],
    steps: [
      "List every school, course, volunteer day and paid job, however small.",
      "For each, write one line about what you were responsible for.",
      "Choose a simple single-page layout that prints well in black and white.",
      "Write a four-line message to send with it — that's the part that gets replies."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  },
  {
    id: "paperwork-checklist",
    title: "A checklist for confusing paperwork",
    tagline: "Visas, insurance, permits, registration.",
    describe: "Paste the requirements once and get a checklist with the documents, the dates and what's still missing. The point isn't the list — it's not discovering the missing paper at the counter, on the last day.",
    area: "work", goals: ["ease", "help"], minutes: "weekend", lanes: ["assistant", "ready"],
    needs: ["A phone", "The official instructions"],
    steps: [
      "Copy the official requirements exactly, including the wording.",
      "Turn each into a tick with the document it needs.",
      "Add the office hours, the fee and the deadline.",
      "Photograph each document as you gather it, into the same entry."
    ],
    kit: {
      publish: ["Netlify", "https://www.netlify.com/", "Free static hosting"]
    }
  }
];

/* Remix ingredients — a deterministic idea generator, no model required. */
const REMIX_TOPICS = [
  "the weekly shop", "the school run", "the building's water", "your mother's medicine",
  "leftovers in the fridge", "the Saturday market", "your neighbour's toolbox",
  "the football club", "the wedding season", "the shop downstairs",
  "the bus that never comes", "your cousin's bakery", "the summer holiday", "the electricity bill"
];

const REMIX_FORMATS = [
  "a one-page website", "a weekly WhatsApp message", "a printable sheet for the fridge",
  "a tiny phone app", "a shared calendar", "a spreadsheet anyone can open",
  "a QR code taped to the door"
];

const REMIX_CONSTRAINTS = [
  "built in one weekend", "under two hours a week to run", "using no paid tools at all",
  "on a phone that cost less than the dinner", "by one person, alone",
  "by two people who have never met", "without asking anyone's permission"
];
