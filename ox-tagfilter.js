/* Generate tag filtering buttons for org-mode exported HTML documents. Allows
 * to dynamically filter an org-mode exported HTML document by tags and
 * TODO-keywords, revealing only content that matches the selected items and
 * hiding the rest.
 * 
 * It filters both a generated table-of-contents (if present) and the content
 * itself.
 * 
 * Saves selected tags to browser local storage and re-applies the filtering
 * selection on page (re)load.
 *
 * Tested with: Org 9.5.3 (Emacs 27.1 and Emacs 28.1)
 * Source code: https://github.com/oyvindstegard/ox-tagfilter-js/
 * Author:      Øyvind Stegard <oyvind@stegard.net>
 */

'use strict';

const OXTF = {
    version: '0.6'
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
}
button#oxtf-clear:active {
  filter: invert(1);
}
button#oxtf-clear:after {
  content: " [ESC]";
  font-weight: normal !important;
  font-size: 70%;
  vertical-align: 10%;
}
.oxtf-invisible {
  display: none;
}
`;
    return styleElem;
};

OXTF.invisibleClassName = 'oxtf-invisible'; // CSS class used to hide content
OXTF.tagsDataAttribute = 'oxtfTags';        // data attr used for storing resolved tag sets in DOM
OXTF.filterListId = 'oxtf-filter-list';     // Id of filter list buttons in DOM

/* Collects tags from org-mode exported HTML document.
   
   Populates all "span.tag" DOM nodes with data-attribute
   'OXTF.tagsDataAttribute', which is the resolved set of all tags that apply to
   that content, considering tag inheritance. String formatted as a JSON array.

   Returns a Set of all found tags in document.
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
        return elem.nodeName === 'A' || elem.nodeName.match(/H[1-9]/);
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
        elem.dataset[OXTF.tagsDataAttribute] = JSON.stringify(Array.from(allTagValues));
        allTagValues.forEach(t => documentTagValues.add(t));
    });

    return documentTagValues;
};

/* Accepts a Set of selected tags as argument. Reveals content that
   matches all tags and hides the rest.

   Returns a set of tags for the narrowed visible content or null if
   all content is visible (no tags selected).
*/
OXTF.revealMatchingContent = (contentRoot, selectedTags) => {
    contentRoot.querySelectorAll('div#text-table-of-contents, div.outline-2')
        .forEach(topLevelContentNode => {
            const allElements = topLevelContentNode.getElementsByTagName('*');
            for (let i=0; i<allElements.length; i++) {
                if (selectedTags.size === 0) {
                    allElements[i].classList.remove(OXTF.invisibleClassName);
                } else {
                    allElements[i].classList.add(OXTF.invisibleClassName);
                }
            }
        });
    
    if (selectedTags.size === 0) {
        return null;
    }

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
                    || n.firstElementChild.nodeName.match(/H[1-9]/))) {
                revealSubtree(n.firstElementChild);
            }
            n = n.parentNode;
        }
    };

    // Take care never to hide filter list buttons, in case they are injected
    // at a custom place in DOM.
    revealSubtree(document.getElementById(OXTF.filterListId));
    revealAncestorsSparsely(document.getElementById(OXTF.filterListId));

    const visibleContentTags = new Set();

    contentRoot.querySelectorAll('span.tag, span.todo, span.done')
        .forEach(spanElem => {
            const allTagValues = new Set(JSON.parse(spanElem.dataset[OXTF.tagsDataAttribute]));
            
            for (let tag of selectedTags) {
                if (!allTagValues.has(tag)) {
                    return;
                }
            }

            allTagValues.forEach(t => visibleContentTags.add(t));
            
            const heading = spanElem.closest('li,h1,h2,h3,h4,h5,h6,h7,h8,h9');
            revealSubtree(heading);
            if (heading.nodeName.match(/H[1-9]/)) {
                let headingSibling = heading.nextElementSibling;
                while (headingSibling) {
                    revealSubtree(headingSibling);
                    headingSibling = headingSibling.nextElementSibling;
                }
            }

            revealAncestorsSparsely(heading);
        });

    return visibleContentTags;
};

OXTF.init = (ev) => {
    const contentRoot = document.querySelector('div#content, div.content');
    
    const documentTagSet = OXTF.collectTags(contentRoot);

    const savedSelectedTagSet = OXTF.persistence.loadSelectedTags()
          .filter(t => documentTagSet.has(t));

    const filterList = document.createElement('div');
    filterList.id = OXTF.filterListId;

    const updateFiltering = () => {
        const listNode = filterList;
        let selectedTags = new Set(Array.from(listNode.querySelectorAll('button.oxtf-active'))
                                     .map(e => e.innerText));
        let visibleContentTags = OXTF.revealMatchingContent(contentRoot, selectedTags);

        // Check for impossible combination of selected filter tags. This can
        // occur if the persisted set of filter selections is loaded on new/modified
        // document content initially. In that case, reset.
        if (visibleContentTags !== null && visibleContentTags.size === 0) {
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
        updateFiltering();
    };

    // Add filtering buttons
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

    // Clear filters support
    if (documentTagSet.size > 0) {
        const clearFiltersButton = document.createElement('button');
        clearFiltersButton.id = 'oxtf-clear';
        clearFiltersButton.classList.add('oxtf');
        clearFiltersButton.innerText = 'Clear';
        clearFiltersButton.addEventListener('click', (ev) => clearFiltering());
        filterList.append(clearFiltersButton);

        // Connect an ESC key listener to clear filters button
        document.addEventListener('keydown', (ev) => {
            if (ev.keyCode === 27) {
                clearFiltersButton.classList.add('oxtf-active');
            }
        });
        document.addEventListener('keyup', (ev) => {
            if (ev.keyCode === 27) {
                clearFiltersButton.classList.remove('oxtf-active');
                clearFiltersButton.dispatchEvent(new Event('click'));
            }
        });
    }

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
