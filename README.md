# Dynamic heading filtering in Org-mode exported HTML documents

This JavaScript code adds dynamic tag filtering and heading search to HTML
documents exported from Emacs [Org-mode](https://orgmode.org/). It allows to
hide/reveal page content based on tags, TODO-keywords and heading text, which
may be useful for larger documents like journals, all-in-one notes files, etc.

Author's use case: I have a growing journal of notes which is automatically
published as HTML to a private web space. When looking back at stuff or looking
for something specific, I find it useful to be able to quickly filter the page
to specific content (and hide the rest).

## Version 1.0 – now includes a heading search box

- The search box will allow you til filter on heading texts, and it works even
  if you do not have any tags in your Org documents.
- Performance improvements, better DOM update strategy.

## Screencast (older version)

<p align="center"><img src="screencast.gif?raw=true" alt="Screencast"/></p>

The CSS for the screencast document can be found here:
https://sandyuraz.com/blogs/orgmode-css/

TODO update to also show search box, which is new in version 1.0.

## Usage

Include the script in exported HTML documents by adding the following Org-mode
line to your org files:

    #+HTML_HEAD_EXTRA: <script src="https://cdn.jsdelivr.net/gh/oyvindstegard/ox-tagfilter-js/ox-tagfilter.js"></script>

Alternatively you can set the org-mode variable `org-html-head-extra` and
include the `<script>..` tag there, or just include it anywhere in documents
really.

You may also copy the [`ox-tagfilter.js`](ox-tagfilter.js) file to your own
hosting and change the URL as appropriate, if you dislike the dependency on
jsdelivr.net.

If the HTML document has exported tags or TODO-keywords in it, you should see
the values appear as buttons on the top. Click those to filter the content
dynamically. Press the <kbd>ESC</kbd> key to clear all selected buttons and show
all content.

As you filter the content, the set of available filters are reduced, so that you
can avoid selecting combinations that match nothing.

### Custom location of filter buttons in HTML document

If you don't like the default location of the filter buttons, this can be
customized by inserting a placeholder `<div>`-tag anywhere you like in the
exported HTML document. You can include it with an HTML export block such as:

    #+BEGIN_EXPORT html
    <div id='oxtf-filter-list'></div>
    #+END_EXPORT

The filter buttons will replace that particular element, instead of being
injected in the default location at the top of the document.

## Demo (test documents)

The following HTML documents have been exported from [`test.org`](test.org)
using Org mode with completely default configuration and only changing the
doctype settings:

- [test-ox-html5.html](https://stegard.net/ox-tagfilter-js-preview/test-ox-html5.html)
- [test-ox-html5-fancy.html](https://stegard.net/ox-tagfilter-js-preview/test-ox-html5-fancy.html)
- [test-ox-html5-notoc.html](https://stegard.net/ox-tagfilter-js-preview/test-ox-html5-notoc.html)
- [test-ox-xhtml-strict.html](https://stegard.net/ox-tagfilter-js-preview/test-ox-xhtml-strict.html)
- [text-ox-html5-existing-placeholder.html](https://stegard.net/ox-tagfilter-js-preview/text-ox-html5-existing-placeholder.html)

## Compatibility

The script is compatible with the most common HTML [doc-type
flavours](https://orgmode.org/manual/HTML-doctypes.html) that Org-mode supports.
This includes `html5` (including "fancy" variant) and `xhtml-strict`.

In general, the JavaScript code only works in modern web browsers.
