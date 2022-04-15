/* Generate tag filtering buttons for org-mode exported HTML documents. Allows
 * to dynamically filter an org-mode exported HTML document by tags, revealing
 * only content that matches the selected tags and hiding the rest.
 *
 * It filters both a generated table-of-contents (if present) and the content
 * itself.
 * 
 * Tested with: Org 9.5.2, Emacs 27.1.
 * Source code: https://github.com/oyvindstegard/ox-tagfilter-js/
 * Author:      Øyvind Stegard <oyvind@stegard.net>
 */

'use strict';

const OXTF = {
    version: '0.1'
};

/* Styles used. These are injected into DOM automatically. */
OXTF.createStyleElement = () =>  {
    const styleElem = document.createElement('style');
    styleElem.innerText = `
.oxtf-filter-list {}
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
button.oxtf-active {
  filter: invert(1);
  font-weight: bold !important;
}
.oxtf-invisible {
  display: none;
}
`;
    return styleElem;
};

OXTF.invisibleClassName = 'oxtf-invisible';
OXTF.tagsDataAttribute = 'oxtfTags';

/* Collects tags from org-mode exported HTML document.
   
   Populates all "span.tag" DOM nodes with data-attribute
   'OXTF.tagsDataAttribute', which is the resolved set of all tags that apply to
   that content, considering tag inheritance. String formatted as a JSON array.

   Returns a Set of all found tags in document.
 */
OXTF.collectTags = (contentRoot) => {
    const collectSpanTags = (spanElem, tagSet) => {
        for (let i=0; i<spanElem.childNodes.length; i++) {
            const child = spanElem.childNodes[i];
            if (child.nodeName !== 'SPAN') continue;
            child.classList.forEach(className => {
                if (className !== OXTF.invisibleClassName) {
                    tagSet.add(className);
                }
            });
        }
    };

    const documentTagValues = new Set();

    contentRoot.querySelectorAll('span.tag').forEach(elem => {
        let n = elem;
        const allTagValues = new Set();
        while (n && n.nodeType === Node.ELEMENT_NODE && n !== contentRoot) {
            for (let i=0; i<n.childNodes.length; i++) {
                const child = n.childNodes[i];
                if (child.nodeName === 'SPAN' && child.classList.contains('tag')) {
                    collectSpanTags(child, allTagValues);
                } else if (child.hasChildNodes()) {
                    for (let j=0; j<child.childNodes.length; j++) {
                        const grandchild = child.childNodes[j];
                        if (grandchild.nodeName === 'SPAN'
                            && grandchild.classList.contains('tag')) {
                            collectSpanTags(grandchild, allTagValues);
                        }
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
   matches all tags and hides the rest. */
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
        return;
    }

    contentRoot.querySelectorAll('span.tag')
        .forEach(spanTagElem => {
            const allTagValues = new Set(JSON.parse(spanTagElem.dataset[OXTF.tagsDataAttribute]));
            
            let revealContent = true;
            for (let tag of selectedTags) {
                if (!allTagValues.has(tag)) {
                    revealContent = false;
                    break;
                }
            }

            if (revealContent) {
                spanTagElem.parentNode.parentNode.querySelectorAll('.' + OXTF.invisibleClassName)
                    .forEach(e => e.classList.remove(OXTF.invisibleClassName));

                let n = spanTagElem;
                while (n && n.nodeType === Node.ELEMENT_NODE) {
                    n.classList.remove(OXTF.invisibleClassName);
                    if (n.firstElementChild
                        && (n.firstElementChild.nodeName === 'A'
                            || n.firstElementChild.nodeName.match(/H[1-9]/))) {
                        n.firstElementChild.classList.remove(OXTF.invisibleClassName);
                        const descendants = n.firstElementChild.getElementsByTagName('*');
                        for (let i=0; i<descendants.length; i++) {
                            descendants[i].classList.remove(OXTF.invisibleClassName);
                        }
                    }
                    n = n.parentNode;
                }
            }
        });
};

OXTF.init = (ev) => {
    const contentRoot = document.querySelector('div#content, div.content');
    
    const documentTagSet = OXTF.collectTags(contentRoot);

    const filterList = document.createElement('div');
    filterList.id = 'oxtf-filter-list';

    documentTagSet.forEach(tagText => {
        const button = document.createElement('button');
        button.classList.add('oxtf');
        button.innerText = tagText;
        
        button.addEventListener('click', (ev) => {
            const buttonNode = ev.target;
            buttonNode.classList.toggle('oxtf-active');
            const listNode = buttonNode.parentNode;
            const selectedTags = new Set(Array.from(listNode.querySelectorAll('button.oxtf-active'))
                                    .map(e => e.innerText));
            OXTF.revealMatchingContent(contentRoot, selectedTags);
        });
        
        filterList.append(button);
    });

    // Finally hook into live DOM:
    document.getElementsByTagName('head').item(0).append(OXTF.createStyleElement());
    if (document.querySelector('header')) {
        document.querySelector('header').append(filterList); // HTML5
    } else {
        contentRoot.insertBefore(filterList, document.querySelector('h1.title').nextSibling); // XHTML
    }

    // Add ESC key listener (clear all active tag filters).
    document.addEventListener('keyup', (ev) => {
        if (ev.keyCode === 27) {
            document.getElementById('oxtf-filter-list')
                .querySelectorAll('button.oxtf-active').forEach((button) => {
                    button.classList.remove('oxtf-active');
                });
            OXTF.revealMatchingContent(contentRoot, new Set());
        }
    });
};

document.addEventListener('DOMContentLoaded', OXTF.init);

/* Local Variables: */
/* js2-additional-externs: () */
/* End: */
