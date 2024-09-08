const currentSelectors = [];
const storedValues = {};
const listeners = new Map(); // Store the listener references here
const buttonsAdded = {};


// Function to handle button click events
function createIncrementDecrementButtons(selector) {
  // Check if buttons have already been added for this selector
  if (buttonsAdded[selector.id]) {
    return;
  }
  buttonsAdded[selector.id] = true; // Mark the buttons as added
  // Create a wrapper for the buttons
  const buttonWrapper = document.createElement('div');
  buttonWrapper.className = 'added-button-wrapper';

  // Create the increment button
  const incrementButton = document.createElement('button');
  incrementButton.textContent = '+';
  incrementButton.className = 'added-button increment-button';
  incrementButton.addEventListener('click', () => {
    // Check to see if the selector is at the last value
    const lastValue = selector.options[selector.options.length - 1].value;
    if (selector.value !== "" && selector.value !== lastValue) {
      selector.value = parseInt(selector.value) + 1; // Increment the value
    } else {
      // set the value to the first option
      selector.value = selector.options[1].value;
    }
    const event = new Event('change', { bubbles: true });
    selector.dispatchEvent(event); // Trigger the change event to simulate user interaction
  });

  // Create the decrement button
  const decrementButton = document.createElement('button');
  decrementButton.textContent = '-';
  decrementButton.className = 'added-button decrement-button';
  decrementButton.addEventListener('click', () => {
    if (selector.value !== "" && parseInt(selector.value) > 1) {
      selector.value = parseInt(selector.value) - 1; // Decrement the value
    } else {
      // set the value to the last option
      selector.value = selector.options[selector.options.length - 1].value;
    }
    const event = new Event('change', { bubbles: true });
    selector.dispatchEvent(event); // Trigger the change event to simulate user interaction
  });

  // Append the buttons to the wrapper
  buttonWrapper.appendChild(incrementButton);
  buttonWrapper.appendChild(decrementButton);

  // append it to the selector
  selector.parentElement.appendChild(buttonWrapper);
  // find the parentElement's svg child and set the right margin to 1rem
  const svg = selector.parentElement.querySelector('svg');
  if (svg) {
    svg.style.marginRight = '1rem';
  }
}

// Function to handle selector change events
function selectorChangeHandler(event, index) {
  console.log("Got selector event", index, event.target.id, event.target.value);
  // Ensure the value isn't already stored
  if (storedValues[index] === event.target.value) {
    return;
  }
  event.target.parentElement.classList.add('selector-updated'); // Add a class to indicate that the value has been updated
  chrome.storage.local.set({ [`${index}`]: event.target.value });
}

// Function to add event listeners to all elements with ids that match SELECTOR_*
const addListenersToSelectors = () => {

  // Remove all previous listeners
  currentSelectors.forEach((selector, index) => {
    const listener = listeners.get(selector); // Retrieve the stored event listener
    if (listener) {
      selector.removeEventListener('change', listener); // Remove the exact listener
      listeners.delete(selector); // Remove the reference from the map
    }
  });

  currentSelectors.splice(0, currentSelectors.length); // Clear the currentSelectors array

  const allSelectors = document.querySelectorAll('[id^="SELECTOR_"]'); // Select all elements with id starting with 'SELECTOR_'
  
  if (!allSelectors) {
    return [];
  }

  // Filter to include only those with IDs matching SELECTOR_[digits] (e.g., SELECTOR_1, SELECTOR_2, etc.)
  const selectors = Array.from(allSelectors).filter((element) => {
    return /^SELECTOR_\d+$/.test(element.id);  // Regex to match SELECTOR_ followed by digits
  });

  currentSelectors.push(...selectors); // Store current selectors

  console.log("Found selectors", selectors);

  // Add event listeners to new selectors
  selectors.forEach((selector, index) => {
    const handler = (event) => selectorChangeHandler(event, index); // Create a named handler function
    selector.addEventListener('change', handler); // Add event listener
    listeners.set(selector, handler); // Store the listener reference in the map
    createIncrementDecrementButtons(selector); // Create increment/decrement buttons
  });

  // Retrieve and apply stored values
  selectors.forEach((selector, index) => {
    chrome.storage.local.get(`${index}`, (result) => {
      console.log("Got stored value", index, result);
      if (result[index]) {
        storedValues[index] = result[index]; // Store the value in the storedValues object
        selector.value = result[index]; // Set the value of the selector to the stored value
        selector.parentElement.classList.add('selector-restored'); // Add a class to indicate that the value has been restored
        console.log(`Restored value for ${selector.id}: ${result[index]}`);

        const event = new Event('change', { bubbles: true });
        selector.dispatchEvent(event); // Trigger the change event to simulate user interaction
      }
    });
  });

  return selectors;
};

// Function to observe only the dialog
const observeDialog = () => {
  const dialogElement = document.querySelector('div[role="dialog"]');
  
  if (dialogElement) {
    // Set up the MutationObserver to watch for changes inside the dialog
    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          // When new nodes are added within the dialog, try adding listeners to the new elements
          const foundSelectors = addListenersToSelectors(dialogElement);
          if (foundSelectors.length > 0) {
            observer.disconnect();  // Stop observing the dialog if listeners are added
          }
        }
      }
    });

        // Call initially to add listeners if the elements are already there
    const foundSelectors = addListenersToSelectors(dialogElement);

    if (foundSelectors.length === 0) {
      // Start observing the dialog element for changes
      observer.observe(dialogElement, {
        childList: true,  // Watch for new child nodes
        subtree: true     // Observe all descendants within the dialog
      });
    }
  }
};

// Set up another observer to monitor when the dialog is added to the page
const dialogObserver = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'childList') {
      // Look for a dialog being added
      if (mutation.target.role === 'dialog' && mutation.target) {
        console.log('Dialog added:', mutation);
        // Stop observing the document body
        dialogObserver.disconnect();
        // Observe the dialog element
        observeDialog();
      }
    }
  }
});

// Function to check the current URL and run observer if it's the scheduling page
const checkAndRunObserver = () => {
  setTimeout(() => {
    if (window.location.pathname.includes('/compose/post/schedule')) {
      console.log("URL contains /compose/post/schedule, starting observer");
      const foundSelectors = addListenersToSelectors();

      if (foundSelectors.length === 0) {
        // Start observing the document body to detect when the dialog is added
        dialogObserver.observe(document.body, {
          childList: true,  // Watch for new child nodes in the body
          subtree: true     // Observe all descendants in the body
        });
      }
    } else {
      console.log("URL does not contain /compose/post/schedule, no action taken", window.location.pathname);
    }
  }, 100);
};

// Add an event listener to the document for URL changes
window.addEventListener('popstate', checkAndRunObserver);  // For back/forward navigation
window.addEventListener('pushstate', checkAndRunObserver); // For pushState changes
navigation.addEventListener("navigate", checkAndRunObserver); // For navigation changes

// run observer when button with testid="scheduleOption" is clicked
document.addEventListener('click', (event) => {
  if (event.target.getAttribute('data-testid') === 'scheduleOption') {
    checkAndRunObserver();
  }
});

window.addEventListener('load', () => {
  // Reinitialize your script on page load or navigation
  checkAndRunObserver(); 
});

// Also run on page load in case the user starts directly on the scheduling page
checkAndRunObserver();

// Call the function to add listeners and restore values
addListenersToSelectors();