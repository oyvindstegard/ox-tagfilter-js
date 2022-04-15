# Dynamic tag filtering in org-mode exported HTML documents

## Screencast

> ![Screencast](screencast.gif?raw=true)

## Usage

Include script in exported HTML documents by adding the following Org-mode
line to your org files:

    #+HTML_HEAD_EXTRA: <script src="https://cdn.jsdelivr.net/gh/oyvindstegard/ox-tagfilter-js/ox-tagfilter.js"></script>

Alternatively you can set the org-mode variable `org-html-head-extra` and
include the `<script>..` tag there, or just include it anywhere in documents
really.

You may also copy the [`ox-tagfilter.js`](ox-tagfilter.js) file to your own
hosting and change the URL as appropriate, if you dislike the dependency on
jsdelivr.net.

If the HTML document has exported tags in it, you should see all the tags appear
as buttons on the top. Click those to filter the content dynamically. Press the
<kbd>ESC</kbd> key to clear all selected tags and show all content.

## Demo (test documents)

The following HTML documents have been exported from [`test.org`](test.org)
using Org mode with completely default configuration and only changing the
doctype settings:

- [test-ox-html5.html](https://htmlpreview.github.io/?https://github.com/oyvindstegard/ox-tagfilter-js/blob/main/test-ox-html5.html)
- [test-ox-html5-fancy.html](https://htmlpreview.github.io/?https://github.com/oyvindstegard/ox-tagfilter-js/blob/main/test-ox-html5-fancy.html)
- [test-ox-html5-notoc.html](https://htmlpreview.github.io/?https://github.com/oyvindstegard/ox-tagfilter-js/blob/main/test-ox-html5-notoc.html)
- [test-ox-xhtml-strict.html](https://htmlpreview.github.io/?https://github.com/oyvindstegard/ox-tagfilter-js/blob/main/test-ox-xhtml-strict.html)


## Compatibility

The script is compatible with the most common HTML [doc-type
flavours](https://orgmode.org/manual/HTML-doctypes.html) that Org-mode supports.
This includes `html5` (including "fancy" variant) and `xhtml-strict`.

In general, the JavaScript code only works in modern web browsers.
