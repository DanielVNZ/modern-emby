import { useState, useEffect } from 'react';

interface LoadingScreenProps {
  message?: string;
  isVisible?: boolean;
}

const funnyMessages = [
  // Classic tech humor
  "Loading the multiverse...",
  "Reticulating splines...",
  "Convincing pixels to cooperate...",
  "Bribing the server hamsters...",
  "Untangling the ethernet cables...",
  "Warming up the flux capacitor...",
  "Asking nicely for your content...",
  "Polishing the pixels...",
  "Herding digital cats...",
  "Consulting the movie gods...",
  "Spinning up the quantum drives...",
  "Teaching AI to appreciate cinema...",
  "Downloading more RAM...",
  "Negotiating with the cloud...",
  "Buffering your excitement...",
  "Summoning the streaming spirits...",
  "Calibrating the binge-watch meter...",
  "Feeding the server gremlins...",
  "Assembling the Avengers... of data...",
  "Waking up the sleeping servers...",
  "Generating random loading message...",
  "Almost there... probably...",
  "Defragmenting the internet...",
  "Teleporting your media...",
  
  // Pop culture references
  "Asking Gandalf for directions...",
  "Waiting for Godot... and your data...",
  "Convincing Thanos to share...",
  "Searching for the One Ring... of buffering...",
  "Consulting the Oracle...",
  "Taking the red pill...",
  "Finding Nemo... in the database...",
  "Waking up Neo...",
  "Escaping the Matrix...",
  "Charging the lightsaber...",
  "Engaging warp drive...",
  "Reversing the polarity...",
  "Recalibrating the TARDIS...",
  "Channeling the Force...",
  "Activating Skynet... just kidding...",
  "Asking Jarvis for help...",
  "Deploying the Batmobile...",
  "Charging Mjolnir...",
  "Locating the Infinity Stones...",
  "Opening a portal to Wakanda...",
  "Asking Yoda for patience...",
  "Firing up the DeLorean...",
  "Consulting the Jedi archives...",
  "Negotiating with Darth Vader...",
  "Hitchhiking through the galaxy...",
  "Finding the answer to life, universe, and everything...",
  "Calculating 6 x 9...",
  "Don't panic, just loading...",
  "Bringing balance to the Force...",
  "Assembling Voltron...",
  "Forming like Megazord...",
  
  // Food and drink
  "Brewing some coffee for the servers...",
  "Feeding pizza to the developers...",
  "Microwaving some bandwidth...",
  "Adding extra cheese to your stream...",
  "Marinating the metadata...",
  "Seasoning the search results...",
  "Toasting the thumbnails...",
  "Buttering up the backend...",
  "Sprinkling magic dust on servers...",
  "Baking fresh content...",
  "Letting the data simmer...",
  "Adding a pinch of patience...",
  "Stirring the streaming pot...",
  "Whisking the WiFi...",
  "Fermenting the files...",
  
  // Animals
  "Teaching monkeys to code...",
  "Waiting for the carrier pigeon...",
  "Asking the rubber duck for advice...",
  "Herding electrons like cats...",
  "Training squirrels to run faster...",
  "Waking up the server turtles...",
  "Consulting the coding owl...",
  "Racing the server snails...",
  "Befriending the debug duck...",
  "Negotiating with code monkeys...",
  "Feeding treats to the firewall dog...",
  "Untangling the cat from the cables...",
  
  // Office humor
  "Scheduling a meeting about loading...",
  "Sending passive-aggressive emails...",
  "Updating the Jira tickets...",
  "Blaming it on the intern...",
  "Checking if it's Friday yet...",
  "Pretending to look busy...",
  "Waiting for stakeholder approval...",
  "Synergizing the bandwidth...",
  "Leveraging core competencies...",
  "Thinking outside the box...",
  "Moving the needle...",
  "Circling back to the servers...",
  "Taking this offline...",
  "Putting a pin in it...",
  "Running it up the flagpole...",
  "Boiling the ocean of data...",
  
  // Gaming references
  "Pressing F to pay respects...",
  "Respawning the connection...",
  "Farming XP for faster loads...",
  "Rolling for initiative...",
  "Entering the Konami code...",
  "Blowing on the cartridge...",
  "Inserting coin to continue...",
  "Loading save file...",
  "Unlocking achievements...",
  "Speed running the load time...",
  "Checking for fall damage...",
  "Mining for content diamonds...",
  "Crafting your experience...",
  "Opening loot boxes of data...",
  "Completing side quests...",
  "Finding the secret level...",
  "Defeating the loading boss...",
  "Collecting power-ups...",
  "Activating god mode...",
  "Using cheat codes...",
  
  // Self-aware loading
  "Thinking of something clever to say...",
  "Writing more loading messages...",
  "Questioning existence...",
  "Having an existential crisis...",
  "Wondering why you're still reading...",
  "Making this loading screen entertaining...",
  "Hoping you'll find this funny...",
  "Trying to be original...",
  "Running out of ideas...",
  "Copying from Stack Overflow...",
  "Googling how to load faster...",
  "Reading the documentation... lol jk...",
  "Pretending to understand the code...",
  "Blaming the previous developer...",
  "It works on my machine...",
  "Have you tried turning it off and on?...",
  "Clearing the cache... mentally...",
  "Debugging with console.log...",
  "Adding more cowbell...",
  "Making it pop more...",
  
  // Science and space
  "Bending space-time...",
  "Calculating quantum fluctuations...",
  "Accelerating particles...",
  "Splitting atoms for speed...",
  "Harnessing dark energy...",
  "Folding dimensions...",
  "Adjusting for relativity...",
  "Entangling some qubits...",
  "Reversing entropy locally...",
  "Discovering new elements...",
  "Simulating the universe...",
  "Expanding the multiverse...",
  "Collapsing wave functions...",
  "Observing Schrödinger's server...",
  "Tunneling through firewalls...",
  
  // Random absurdity
  "Teaching fish to climb trees...",
  "Counting to infinity... twice...",
  "Dividing by zero safely...",
  "Finding the end of pi...",
  "Solving P vs NP...",
  "Catching lightning in a bottle...",
  "Herding unicorns...",
  "Painting with all the colors of the wind...",
  "Making fetch happen...",
  "Turning water into bandwidth...",
  "Finding where the socks go...",
  "Locating the other Tupperware lid...",
  "Untying the Gordian knot...",
  "Squaring the circle...",
  "Finding a needle in a haystack...",
  "Waiting for paint to dry... digitally...",
  "Watching grass grow in binary...",
  "Counting grains of digital sand...",
  "Rearranging deck chairs optimally...",
  "Polishing the invisible pixels...",
  
  // Music and entertainment
  "Dropping the bass... line connection...",
  "Remixing the loading sequence...",
  "Composing elevator music...",
  "Tuning the internet guitar...",
  "Conducting the server orchestra...",
  "Finding the beat...",
  "Syncing to the rhythm...",
  "Playing air guitar impatiently...",
  "Humming the loading tune...",
  "Creating a montage...",
  
  // Encouraging messages
  "Good things come to those who wait...",
  "Patience is a virtue, apparently...",
  "Rome wasn't built in a day...",
  "You're doing great, keep waiting...",
  "This is worth it, trust us...",
  "Almost there, we promise...",
  "Your patience is appreciated...",
  "Thanks for sticking around...",
  "You're a champion of waiting...",
  "Gold medal in patience goes to you...",
];

export function LoadingScreen({ message, isVisible = true }: LoadingScreenProps) {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [animationClass, setAnimationClass] = useState(isVisible ? 'animate-fadeIn' : '');
  const [funnyMessage] = useState(() => 
    funnyMessages[Math.floor(Math.random() * funnyMessages.length)]
  );

  const displayMessage = message || funnyMessage;

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setAnimationClass('animate-fadeIn');
    } else {
      setAnimationClass('animate-fadeOut');
      // Wait for fade out animation to complete before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div className={`min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 ${animationClass}`}>
      <div className="flex flex-col items-center gap-8">
        {/* Modern animated logo */}
        <div className="relative">
          {/* Outer pulse ring */}
          <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
          
          {/* Main icon container */}
          <div className="relative rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/50 p-6">
            {/* Logo image */}
            <img src="/Logo.png" alt="Aether" className="h-40 object-contain animate-pulse rounded-2xl" />
          </div>
        </div>
        
        {/* Loading text with shimmer effect */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-white text-xl font-medium tracking-wide animate-pulse">{displayMessage}</div>
          
          {/* Modern progress bar */}
          <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%]" />
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
        .animate-fadeOut {
          animation: fadeOut 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
