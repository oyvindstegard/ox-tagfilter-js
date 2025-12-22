/* Generate tag filtering buttons and a heading search box for org-mode exported
 * HTML documents. Allows for dynamic filtering, revealing only content that
 * matches selected tags and search words.
 * 
 * It filters both a generated table-of-contents (if present) and the content
 * itself.
 * 
 * Saves selected tags to browser local storage and re-applies the filtering
 * selection on page (re)load.
 *
 * Tested with: Org 9.7.39 (Emacs 30.2)
 * Source code: https://github.com/oyvindstegard/ox-tagfilter-js/
 * Author:      Øyvind Stegard <oyvind@stegard.net>
 */

'use strict';

const OXTF = {
    version: '1.0'
};

OXTF.persistence = new function() {
    const self = this;
    const db = window.localStorage;
    const storageKey = 'OXTF_' + (document.location.pathname || "/");

    /* Returns an array of previously stored selected tags. */
    this.loadSelectedTags = function() {
        if (!db) {
            return [];
        }
        const dbValue = db.getItem(storageKey);
        return dbValue ? JSON.parse(dbValue) : [];
    };

    /* Saves an array of currently selected tags. */
    this.saveSelectedTags = function(selectedTags) {
        if (!db) {
            return;
        }
        const dbValue = JSON.stringify(selectedTags);
        db.setItem(storageKey, dbValue);
    };
};

/* Styles used. These are injected into DOM automatically. */
OXTF.createStyleElement = () =>  {
    const styleElem = document.createElement('style');
    styleElem.innerText = `
#oxtf-filter-list {
  margin-top: 0.2em;
  margin-bottom: 0.2em;
}
button.oxtf {
  font-family: monospace;
  font-weight: normal;
  margin: 0.5em 0.5em 0 0;
  padding-left: 0.5em;
  padding-right: 0.5em;
  min-width: 3em;
  border: 1px solid #bbb;
  border-radius: 3px;
}
button.oxtf-filter {}
button.oxtf-active {
  filter: invert(1);
  font-weight: bold !important;
}
button#oxtf-clear {
  border: 2px solid #9C9;
  font-weight: bold !important;
  color: #666666;
  border-radius: 3px;
}
button#oxtf-clear:active {
  filter: invert(1);
}
button#oxtf-clear:after {
  content: " [ESC]";
  font-weight: normal !important;
  font-size: 70%;
  vertical-align: middle;
}
.oxtf-invisible {
  display: none;
}
.oxtf-search{
  margin: 0.5em 0.5em 0 0;
  width: 50%;
  padding: 3px 6px;
  border: 1px solid #bbb;
  border-radius: 3px;
}
`;
    return styleElem;
};

OXTF.invisibleClassName = 'oxtf-invisible';  // CSS class used to hide content
OXTF.tagsDataAttribute = 'oxtfTags';         // data attr used for storing resolved tag sets in DOM
OXTF.normalizedSearchTextAttribute = 'oxtfNormalizedSearchText'; // normalized search text of heading
OXTF.filterListId = 'oxtf-filter-list';      // Id of filter list buttons in DOM

/**
 * @param   {Element} element  Some element.
 * @returns {boolean} Whether the element is considered an org-exported outline heading.
 */
OXTF.isHeadingElement = (element) => {
    if (element && element.nodeName.match(/^H[1-9]/)) {
        return true;
    }
    if (element && element.nodeName === 'LI' && element.firstElementChild && element.firstElementChild.nodeName === 'A') {
        const anchorElementChild = element.firstElementChild;
        if (anchorElementChild.id && anchorElementChild.id.startsWith('org')) {
            return true;
        }
        if (anchorElementChild.hasAttribute('href') && anchorElementChild.getAttribute('href').startsWith('#org')) {
            return true;
        }
    }
    return false;
};

/**
 * @param   {Element} contentRoot  The element that is considered root of document content.
 * @returns {Array<HTMLElement>}   All HTML elements that are considered headings in the org-exported document.
 */
OXTF.getAllHeadingElements = (contentRoot) => {
    return Array.from(contentRoot.querySelectorAll('li:has(> a:first-child),h1,h2,h3,h4,h5,h6,h7,h8,h9'))
        .filter(OXTF.isHeadingElement);
};

/** Collects tags from org-mode exported HTML document.
 *  
 *  Populates all "span.tag" DOM nodes with data-attribute
 *  'OXTF.tagsDataAttribute', which is the resolved set of all tags that apply to
 *  that content, considering tag inheritance. String formatted as a JSON array.
 *
 *  Returns a Set of all found tags in document.
 */
OXTF.collectTags = (contentRoot) => {

    const isTodoSpan = (elem) => {
        return elem.nodeType === Node.ELEMENT_NODE
            && elem.nodeName === 'SPAN'
            && (elem.classList.contains('todo') || elem.classList.contains('done'));
    };

    const isTagSpan = (elem) => {
        return elem.nodeType === Node.ELEMENT_NODE
            && elem.nodeName === 'SPAN'
            && elem.classList.contains('tag');
    };

    const isHeadingOrAnchor = (elem) => {
        return elem.nodeName === 'A' || elem.nodeName.match(/^H[1-9]/);
    };

    const collectSpanTags = (spanElem, tagSet) => {
        if (isTodoSpan(spanElem)) {
            Array.from(spanElem.classList)
                .filter(c => c !== 'todo' && c !== 'done' && c !== OXTF.invisibleClassName)
                .forEach(c => tagSet.add(c));
        } else if (isTagSpan(spanElem)) {
            for (let i=0; i<spanElem.childNodes.length; i++) {
                const child = spanElem.childNodes[i];
                if (child.nodeName !== 'SPAN') continue;
                child.classList.forEach(className => {
                    if (className !== OXTF.invisibleClassName) {
                        tagSet.add(className);
                    }
                });
            }
        }
    };

    const documentTagValues = new Set();

    contentRoot.querySelectorAll('span.tag, span.todo, span.done').forEach(elem => {
        let n = elem;
        const allTagValues = new Set();
        while (n && n.nodeType === Node.ELEMENT_NODE && n !== contentRoot) {
            for (let i=0; i<n.childNodes.length; i++) {
                const child = n.childNodes[i];
                if (isTagSpan(child) || isTodoSpan(child)) {
                    collectSpanTags(child, allTagValues);
                } else if (isHeadingOrAnchor(child)) {
                    for (let j=0; j<child.childNodes.length; j++) {
                        collectSpanTags(child.childNodes[j], allTagValues);
                    }
                }
            }
            n = n.parentNode;
        }

        // Set tags data-attribute on nearest outline heading element
        n = elem.parentElement;
        while (n && n !== contentRoot) {
            if (OXTF.isHeadingElement(n)) {
                n.dataset[OXTF.tagsDataAttribute] = JSON.stringify(Array.from(allTagValues));
                break;
            }
            n = n.parentElement;
        }
        
        allTagValues.forEach(t => documentTagValues.add(t));
    });

    return documentTagValues;
};


/**
 * Resolve plain text contents of a heading element, but without including
 * outline content that follows.
 */
OXTF.headingTextContent = (headingElement) => {
    const statisticsCookieRe = /^\[[0-9]+\/[0-9]+\]$/;
    let textContent = "";
    let node = headingElement.firstChild;
    while (node) {
        let textToAppend = "";
        if (node.nodeType === Node.TEXT_NODE) {
            textToAppend = node.textContent;
        } else if (node.nodeName === 'B') {
            textToAppend = '*' + node.textContent + '*';
        } else if (node.nodeName === 'I') {
            textToAppend = '/' + node.textContent + '/';
        } else if (node.nodeName === 'CODE' && !node.textContent.match(statisticsCookieRe)) {
            textToAppend = node.textContent;
        } else if (node.nodeName === 'P' || node.nodeName === 'SUP' || node.nodeName === 'SUB'
                   || node.nodeName === 'SPAN' || node.nodeName === 'A') {
            textToAppend = node.textContent;
        }
        textContent += textToAppend;
        node = node.nextSibling;
    }
    
    return textContent;
};

/**
 * Given an outline heading element, lookup its aggregated tag set, which
 * must be previously computed and present in data attribute.
 */
OXTF.headingTags = (headingElement) => {
    if (headingElement.dataset[OXTF.tagsDataAttribute]) {
        return JSON.parse(headingElement.dataset[OXTF.tagsDataAttribute]);
    }
    return [];
};

/**
 * Tokenizes AND normalizes a text into a list of word tokens. Normalization includes lower casing, removal of diacritics
 * and removal of certain character classes.
 *
 * @param  {string}  text The text to normalize.
 * @return {Array}   a list of normalized words
 */
OXTF.tokenize = (text) => {
    text = text ? text.trim() : '';
    if (text === '') {
        return new Array();
    }
    return text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')      // decompose and remove diacritics
        .replace(/[_,.?!-()]/g, ' ') // split on punctuation
        .split(/\s+/).map(w => w.toLowerCase());
};

/**
 * Iterates through all document headings and adds data attribute with
 * normalized search text to them. Each heading's search text will include all
 * ancestor search text as well, to get intuitive hierarchical matching for
 * sparse paths to content root.
 *
 * @return {Set<string>} a set of all document keywords found in all headings.
 */
OXTF.collectHeadingKeywords = (contentRoot) => {
    const allHeadingKeywords = new Set();
    
    OXTF.getAllHeadingElements(contentRoot).forEach(headingElement => {
        let combinedHeadingText = OXTF.headingTextContent(headingElement);
        let node = headingElement.parentElement;
        while (node && node !== contentRoot) {
            if (OXTF.isHeadingElement(node)) {
                combinedHeadingText = OXTF.headingTextContent(node) + ' ' + combinedHeadingText;
                node = node.parentElement;
            } else {
                node = node.previousSibling ? node.previousSibling : node.parentElement;
            }
        }
        const keywords = OXTF.tokenize(combinedHeadingText);
        headingElement.dataset[OXTF.normalizedSearchTextAttribute] = keywords.join(' ');
        keywords.forEach(k => allHeadingKeywords.add(k));
    });
    
    return allHeadingKeywords;
};

/**
 * Checks if a heading element has text content that matches all provided search words.
 *
 * @param {HTMLElement} headingElem the heading element
 * @param {Array<string>} normalizedSearchWords array of normalized search words, typically from user input.
 *
 * @return {boolean} true if all search words match the heading text
 */
OXTF.headingMatches = (headingElement, normalizedSearchWords) => {
    const normalizedSearchText = headingElement.dataset[OXTF.normalizedSearchTextAttribute];
    if (normalizedSearchText) {
        for (const word of normalizedSearchWords) {
            if (!normalizedSearchText.includes(word)) {
                return false;
            }
        }
        return true;
    }

    return false;
};

/**
 * Accepts a Set of selected tags as argument.  Reveals content that
 * matches all tags AND all search words, and hides the rest.
 *
 * @param {Node}      contentRoot  The root element that contains the
 *                                 Org mode content (normally <div id="content">)
 * @param {Set}       selectedTags Set of tags that are currently active.
 * @param {string}    searchText   A string of search text input from user.
 *
 * @return {Set|null}  Set of tags that are still visible or null if everything is visible.
 */
OXTF.revealMatchingContent = (contentRoot, selectedTags, searchText) => {
    const searchTokens = OXTF.tokenize(searchText);

    const revealSubtree = (elem) => {
        elem.classList.remove(OXTF.invisibleClassName);
        elem.querySelectorAll('.' + OXTF.invisibleClassName)
            .forEach(e => e.classList.remove(OXTF.invisibleClassName));
    };

    const revealAncestorsSparsely = (elem) => {
        let n = elem.parentNode;
        while (n && n.nodeType === Node.ELEMENT_NODE) {
            n.classList.remove(OXTF.invisibleClassName);
            if (n.firstElementChild
                && (n.firstElementChild.nodeName === 'A'
                    || n.firstElementChild.nodeName.match(/^H[1-9]/))) {
                revealSubtree(n.firstElementChild);
            }
            n = n.parentNode;
        }
    };
    
    if (selectedTags.size === 0 && searchTokens.length === 0) {
        window.requestAnimationFrame(() => {
            contentRoot.querySelectorAll('div#text-table-of-contents, div.outline-2')
                .forEach(topLevelContentNode => {
                    topLevelContentNode.querySelectorAll('.' + OXTF.invisibleClassName).forEach(n =>
                        n.classList.remove(OXTF.invisibleClassName));
                });
        });
        return null; // everything visible, no filtering input
    }

    const headingsToShow = [];
    const visibleContentTags = new Set();
    OXTF.getAllHeadingElements(contentRoot).forEach(headingElem => {
        const allTagValues = OXTF.headingTags(headingElem);

        // Check selected tags
        for (let tag of selectedTags) {
            if (!allTagValues.includes(tag)) {
                return;
            }
        }

        // Check search words
        if (searchTokens.length > 0) {
            if (!OXTF.headingMatches(headingElem, searchTokens)) {
                return;
            }
        }

        allTagValues.forEach(t => visibleContentTags.add(t));
        headingsToShow.push(headingElem);
    });

    window.requestAnimationFrame(() => {
        contentRoot.querySelectorAll('div#text-table-of-contents, div.outline-2')
            .forEach(topLevelContentNode => {
                const allElements = topLevelContentNode.getElementsByTagName('*');
                for (let i=0; i<allElements.length; i++) {
                    if (!headingsToShow.includes(allElements[i])) {
                        allElements[i].classList.add(OXTF.invisibleClassName);
                    }
                }
            });
        
        headingsToShow.forEach(headingElem => {
            revealSubtree(headingElem);
            if (headingElem.nodeName.match(/^H[1-9]/)) {
                let headingSibling = headingElem.nextElementSibling;
                while (headingSibling) {
                    revealSubtree(headingSibling);
                    headingSibling = headingSibling.nextElementSibling;
                }
            }

            revealAncestorsSparsely(headingElem);
        });
        
        // Take care never to hide filter list buttons, in case they are injected
        // at a custom place in DOM.
        revealSubtree(document.getElementById(OXTF.filterListId));
        revealAncestorsSparsely(document.getElementById(OXTF.filterListId));
    });

    return visibleContentTags;
};

OXTF.init = (ev) => {
    const contentRoot = document.querySelector('div#content, div.content');
    
    const documentTagSet = OXTF.collectTags(contentRoot);

    OXTF.collectHeadingKeywords(contentRoot);

    const savedSelectedTagSet = OXTF.persistence.loadSelectedTags()
          .filter(t => documentTagSet.has(t));

    const filterList = document.createElement('div');
    filterList.id = OXTF.filterListId;

    const updateFiltering = () => {
        const listNode = filterList;
        let selectedTags = new Set(Array.from(listNode.querySelectorAll('button.oxtf-active'))
                                   .map(e => e.innerText));
        const searchText = document.getElementById('oxtf-search').value;
        
        let visibleContentTags = OXTF.revealMatchingContent(contentRoot, selectedTags, searchText);
        
        // Check for impossible combination of selected filter tags. This can
        // occur if the persisted set of filter selections is loaded on new/modified
        // document content initially. In that case, reset.
        if (visibleContentTags !== null && visibleContentTags.size === 0 && searchText.trim().length === 0) {
            visibleContentTags = OXTF.revealMatchingContent(contentRoot, new Set());
            selectedTags = new Set();
            listNode.querySelectorAll('button.oxtf-active').forEach(
                n => n.classList.remove('oxtf-active'));
        }

        listNode.querySelectorAll('button.oxtf-filter').forEach(b => {
            if (visibleContentTags === null || visibleContentTags.has(b.innerText)) {
                b.disabled = false;
            } else {
                b.disabled = true;
            }
        });
        OXTF.persistence.saveSelectedTags(Array.from(selectedTags));
    };

    const clearFiltering = () => {
        filterList.childNodes.forEach(b => {
            b.classList.remove('oxtf-active');
            b.disabled = false;
        });
        searchInput.value = '';
        searchInput.focus();
        updateFiltering();
    };

    // Tag filtering buttons
    Array.from(documentTagSet).sort().forEach(tagText => {
        const button = document.createElement('button');
        button.classList.add('oxtf');
        button.classList.add('oxtf-filter');
        if (savedSelectedTagSet.includes(tagText)) {
            button.classList.add('oxtf-active');
        }
        button.innerText = tagText;
        
        button.addEventListener('click', (ev) => {
            const buttonNode = ev.target;
            buttonNode.classList.toggle('oxtf-active');
            updateFiltering();
            try {
                filterList.scrollIntoView({block: 'nearest'});
            } catch (e) {
                filterList.scrollIntoView();
            }
        });
        
        filterList.append(button);
    });

    // Search box
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'oxtf-search';
    searchInput.placeholder = 'Search headings and tags…';
    searchInput.classList.add('oxtf');
    searchInput.classList.add('oxtf-search');
    searchInput.addEventListener('input', (ev) => {
        if (OXTF.searchInputDebounceTimeout) {
            clearTimeout(OXTF.searchInputDebounceTimeout);
            OXTF.searchInputDebounceTimeout = null;
        }
        OXTF.searchInputDebounceTimeout = setTimeout(updateFiltering, 20);
    });
    filterList.append(document.createElement('br'));
    filterList.append(searchInput);

    // Clear button
    const clearFiltersButton = document.createElement('button');
    clearFiltersButton.id = 'oxtf-clear';
    clearFiltersButton.classList.add('oxtf');
    clearFiltersButton.innerText = 'Clear';
    clearFiltersButton.addEventListener('click', (ev) => clearFiltering());
    filterList.append(clearFiltersButton);
    // Connect an ESC key listener to clear button
    document.addEventListener('keydown', (ev) => {
        if (ev.code === 'Escape') {
            clearFiltersButton.classList.add('oxtf-active');
        }
    });
    document.addEventListener('keyup', (ev) => {
        if (ev.code === 'Escape') {
            clearFiltersButton.classList.remove('oxtf-active');
            clearFiltersButton.dispatchEvent(new Event('click'));
        }
    });


    // Finally hook into live DOM:
    document.getElementsByTagName('head').item(0).append(OXTF.createStyleElement());
    const existingFilterListPlaceholder = document.getElementById(OXTF.filterListId);
    if (existingFilterListPlaceholder) {
        existingFilterListPlaceholder.replaceWith(filterList);
    } else if (document.querySelector('header')) {  // HTML5:
        document.querySelector('header').append(filterList);
    } else {                                 // XHTML:
        contentRoot.insertBefore(filterList, document.querySelector('h1.title').nextSibling);
    }

    // Initial update of filtering from possibly saved state.
    updateFiltering();
};

document.addEventListener('DOMContentLoaded', OXTF.init);

/* Local Variables: */
/* js2-additional-externs: () */
/* End: */
