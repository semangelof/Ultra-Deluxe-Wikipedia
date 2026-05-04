chrome.storage.local.get({ font: 'cascadia', spacing: true, sidebar: true }, (settings) => {

    // =========================================================================
    // FEATURE: FONT INJECTION
    // =========================================================================
    const injectFont = () => {
        if (document.getElementById('extension-custom-font')) return;
        const fontStyle = document.createElement('style');
        fontStyle.id = 'extension-custom-font';
        
        const fontFamily = settings.font === 'cascadia' 
            ? "'Cascadia Mono', monospace" 
            : "'Times New Roman', serif";

        fontStyle.textContent = `
            body, #bodyContent, .mw-parser-output, .mw-body h1, .mw-body h2, .mw-body h3, .mw-body h4, .mw-body h5, .mw-body h6 {
                font-family: ${fontFamily} !important;
            }
        `;

        if (document.head) {
            document.head.appendChild(fontStyle);
        } else if (document.documentElement) {
            document.documentElement.appendChild(fontStyle);
        }
    };
    injectFont();
    document.addEventListener('DOMContentLoaded', injectFont);


    // =========================================================================
    // FEATURE: REDUCED LINE SPACING (Exactly as provided)
    // =========================================================================
    if (settings.spacing) {
        (function() {
            'use strict';

            const styleId = 'hardened-style-Wikipedia-Ultra-Compact';

            function injectStyles() {
                if (document.getElementById(styleId)) return;

                const style = document.createElement('style');
                style.id = styleId;
                style.type = 'text/css';

                const css = `
                /* 1. MINIMUM LINE HEIGHT
                   Line height remains 1.05 to ensure ascenders and descenders barely avoid clipping. */
                #bodyContent p,
                #bodyContent li,
                #bodyContent dd,
                #bodyContent dt,
                #bodyContent .mw-parser-output > * {
                    line-height: 1.05 !important;
                }

                /* 2. BARELY THERE PARAGRAPH SPACING
                   Reduced to a near-zero gap to keep paragraphs and lists tightly packed. */
                #bodyContent p,
                #bodyContent ul,
                #bodyContent ol,
                #bodyContent dl {
                    margin-bottom: 0.2rem !important;
                    margin-top: 0 !important;
                    padding-bottom: 0 !important;
                    padding-top: 0 !important;
                }

                /* 3. COMPACT HEADINGS
                   Brings headers closer to the text to match the overall dense aesthetic. */
                #bodyContent h1,
                #bodyContent h2,
                #bodyContent h3,
                #bodyContent h4,
                #bodyContent h5,
                #bodyContent h6 {
                    margin-top: 0.5rem !important;
                    margin-bottom: 0.2rem !important;
                    line-height: 1.1 !important;
                }
            `;

                style.appendChild(document.createTextNode(css));

                if (document.head) {
                    document.head.appendChild(style);
                } else if (document.documentElement) {
                    document.documentElement.appendChild(style);
                }
            }

            // Initial injection
            injectStyles();

            // Heartbeat mechanism (100ms intervals for 5 seconds)
            let attempts = 0;
            const interval = setInterval(() => {
                injectStyles();
                attempts++;
                if (attempts > 50) {
                    clearInterval(interval);
                }
            }, 100);

            // Final safety net
            window.addEventListener('load', injectStyles);

        })();
    }


    // =========================================================================
    // FEATURE: REFERENCES SIDEBAR (Exactly as provided)
    // Only runs on article pages, matching original Tampermonkey @match scope.
    // =========================================================================
    if (settings.sidebar && window.location.pathname.startsWith('/wiki/')) {
        (function() {
            'use strict';

            // =========================================================================
            // 1. GLOBAL HOVER INTERCEPTION
            // =========================================================================
            const blockHoverPopups = function(e) {
                if (!document.getElementById('sidebar-wrapper')) return;

                if (e.target && e.target.closest && e.target.closest('sup.reference, .mw-cite-backlink')) {
                    e.stopImmediatePropagation();
                }
            };['mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave'].forEach(eventType => {
                document.addEventListener(eventType, blockHoverPopups, true);
            });

            // =========================================================================
            // 2. MAIN SIDEBAR INITIALIZATION
            // =========================================================================
            function initSidebar() {
                const contentContainer = document.getElementById('mw-content-text') || document.getElementById('bodyContent');
                if (!contentContainer) return false;

                if (document.getElementById('sidebar-wrapper')) return true;

                // BUGFIX: Bypass Wikipedia's protection lock icons that falsely use the '.mw-parser-output' class.
                // We find the references first, then trace upwards to grab the TRUE article body.
                const firstRef = contentContainer.querySelector('.reflist, .refbegin, .mw-references-wrap, ol.references');
                if (!firstRef) return false;

                const parserOutput = firstRef.closest('.mw-parser-output') || contentContainer.querySelector('.mw-parser-output');
                if (!parserOutput) return false;

                const refSelectors =['.reflist', '.refbegin', '.mw-references-wrap', 'ol.references'];
                let refBlocks = Array.from(parserOutput.querySelectorAll(refSelectors.join(', ')));

                refBlocks = refBlocks.filter(block => {
                    return !refBlocks.some(parent => parent !== block && parent.contains(block));
                });

                if (refBlocks.length === 0) return false;

                parserOutput.querySelectorAll('sup.reference a, .mw-cite-backlink a').forEach(a => {
                    a.removeAttribute('title');
                });

                // The rigid grid container that will permanently separate the layout
                const gridContainer = document.createElement('div');
                gridContainer.id = 'wiki-grid-container';

                // The structural wrapper (allows the sticky sidebar to travel the full height)
                const wrapper = document.createElement('div');
                wrapper.id = 'sidebar-wrapper';

                // The sticky sidebar itself
                const sidebar = document.createElement('div');
                sidebar.id = 'reference-sidebar';

                const title = document.createElement('h3');
                title.textContent = 'References';
                title.className = 'sidebar-ref-title';
                sidebar.appendChild(title);

                refBlocks.forEach(block => {
                    // BUGFIX: Step out of anonymous wrappers to ensure we can properly hide previous sibling headers
                    let topLevelBlock = block;
                    while (topLevelBlock.parentElement && topLevelBlock.parentElement !== parserOutput) {
                        topLevelBlock = topLevelBlock.parentElement;
                    }

                    let prev = topLevelBlock.previousElementSibling;
                    let nodesToHide =[];

                    while (prev) {
                        if ((prev.tagName && prev.tagName.match(/^H[2-6]$/)) || (prev.classList && prev.classList.contains('mw-heading'))) {
                            nodesToHide.push(prev);
                            // If we hit an H2 ("References"), stop. If it's an H3 ("Citations"), hide it and keep looking up.
                            const isH2 = prev.tagName === 'H2' || prev.classList.contains('mw-heading2');
                            if (isH2) break;
                        } else if ((prev.tagName === 'P' && prev.textContent.trim() === '') ||
                                   (prev.classList && prev.classList.contains('clear')) ||
                                   prev.tagName === 'STYLE' || prev.tagName === 'LINK' ||
                                   (prev.tagName === 'DIV' && prev.textContent.trim() === '')) {
                            nodesToHide.push(prev);
                        } else {
                            const isRef = prev.querySelector('.reflist, .refbegin, .mw-references-wrap, ol.references') ||
                                          (prev.classList && (prev.classList.contains('reflist') || prev.classList.contains('refbegin') || prev.classList.contains('mw-references-wrap')));
                            if (!isRef) break;
                        }
                        prev = prev.previousElementSibling;
                    }

                    nodesToHide.forEach(node => { node.style.display = 'none'; });
                    sidebar.appendChild(block);
                });

                wrapper.appendChild(sidebar);

                // Insert the Grid Container into the DOM exactly where parserOutput was
                parserOutput.parentNode.insertBefore(gridContainer, parserOutput);

                // Move the Wikipedia content and our Sidebar into the Grid Columns
                gridContainer.appendChild(parserOutput);
                gridContainer.appendChild(wrapper);

                // =========================================================================
                // 3. BULLETPROOF SCROLL ISOLATION
                // =========================================================================
                const lockScroll = function(e) {
                    const isUp = e.deltaY < 0;
                    const isDown = e.deltaY > 0;
                    const atTop = this.scrollTop <= 0;
                    const atBottom = Math.abs(this.scrollHeight - this.scrollTop - this.clientHeight) < 2;

                    if ((isUp && atTop) || (isDown && atBottom)) {
                        e.preventDefault();
                        e.stopPropagation();
                    } else {
                        e.stopPropagation();
                    }
                };
                sidebar.addEventListener('wheel', lockScroll, { passive: false });
                sidebar.addEventListener('touchmove', lockScroll, { passive: false });

                // =========================================================================
                // 4. CLICK INTERCEPTION
                // =========================================================================
                document.addEventListener('click', function(e) {
                    const link = e.target.closest('sup.reference a, .mw-cite-backlink a, a[href^="#cite_note"]');
                    if (!link) return;

                    const href = link.getAttribute('href');
                    if (!href || !href.startsWith('#')) return;

                    let targetId = href.substring(1);
                    try { targetId = decodeURIComponent(targetId); } catch(err) {}

                    const targetEl = document.getElementById(targetId) || document.getElementById(href.substring(1));

                    if (targetEl && (sidebar.contains(targetEl) || parserOutput.contains(targetEl))) {
                        e.preventDefault();
                        e.stopImmediatePropagation();

                        if (sidebar.contains(targetEl)) {
                            const sidebarRect = sidebar.getBoundingClientRect();
                            const targetRect = targetEl.getBoundingClientRect();
                            sidebar.scrollBy({
                                top: (targetRect.top - sidebarRect.top) - 40,
                                behavior: 'smooth'
                            });
                        } else {
                            targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }

                        const oldBg = targetEl.style.backgroundColor;
                        targetEl.style.transition = 'none';
                        targetEl.style.backgroundColor = 'rgba(255, 215, 0, 0.6)';
                        setTimeout(() => {
                            targetEl.style.transition = 'background-color 1.5s ease';
                            targetEl.style.backgroundColor = oldBg || 'transparent';
                            setTimeout(() => targetEl.style.transition = '', 1500);
                        }, 500);
                    }
                }, true);

                // =========================================================================
                // 5. IRONCLAD CSS INJECTION
                // =========================================================================
                const style = document.createElement('style');
                style.textContent = `
                    @media screen and (min-width: 1200px) {
                        /* Create a strict physical wall between the article and sidebar */
                        #wiki-grid-container {
                            display: grid !important;
                            grid-template-columns: minmax(0, 1fr) 350px !important;
                            gap: 20px !important;
                            align-items: stretch !important; /* MUST stretch for sticky scrolling to work */
                            width: 100% !important;
                            box-sizing: border-box !important;
                        }

                        /* Left Partition (Article Space) */
                        .mw-parser-output {
                            min-width: 0 !important; /* Forces layout engine to NOT stretch for giant images/infoboxes */
                            width: 100% !important;
                            box-sizing: border-box !important;
                            margin: 0 !important;
                            max-width: none !important;
                            padding-right: 0 !important;

                            /* Any bloated tables will now scroll locally instead of destroying the page layout */
                            overflow-x: auto !important;
                            overflow-y: visible !important;
                        }

                        /* Explicitly target requested elements so they cannot occlude the sidebar */
                        table.infobox.vcard, .infobox, table.sidebar {
                            max-width: 100% !important;
                            box-sizing: border-box !important;
                            clear: right !important;
                        }

                        /* Right Partition (Sidebar Space) */
                        #sidebar-wrapper {
                            width: 350px !important;
                            height: 100% !important;
                            position: relative !important;
                            pointer-events: none !important; /* Wrapper allows clicks through empty gaps */
                        }

                        #reference-sidebar {
                            position: sticky !important;
                            top: 20px !important;
                            width: 350px !important;
                            max-height: calc(100vh - 40px) !important;
                            pointer-events: auto !important;

                            background-color: #f8f9fa;
                            border: 1px solid #c8ccd1;
                            border-radius: 4px;
                            padding: 15px 20px;
                            overflow-y: auto !important;
                            overscroll-behavior: contain !important;
                            box-sizing: border-box;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                        }

                        /* Prevent absolute Wikipedia top-elements (coords/status locks) from sitting over the sidebar */
                        .mw-indicators, #coordinates {
                            right: 370px !important;
                        }
                    }

                    .sidebar-ref-title {
                        margin-top: 0 !important;
                        padding-bottom: 8px !important;
                        border-bottom: 1px solid #a2a9b1 !important;
                        font-family: 'Linux Libertine', 'Georgia', 'Times', serif !important;
                        font-size: 1.5em !important;
                        font-weight: normal !important;
                    }
                    #reference-sidebar .reflist,
                    #reference-sidebar .mw-references-wrap {
                        column-count: 1 !important;
                        margin-top: 10px !important;
                    }
                    #reference-sidebar ol.references {
                        padding-left: 20px !important;
                        margin-left: 0 !important;
                    }

                    #reference-sidebar::-webkit-scrollbar { width: 8px; }
                    #reference-sidebar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
                    #reference-sidebar::-webkit-scrollbar-thumb { background: #c8ccd1; border-radius: 4px; }
                    #reference-sidebar::-webkit-scrollbar-thumb:hover { background: #a2a9b1; }

                    /* Mobile/Tablet Fallback disables the Grid safely */
                    @media screen and (max-width: 1199px) {
                        #wiki-grid-container { display: block !important; }
                        .mw-parser-output { overflow-x: visible !important; width: 100% !important; }

                        #sidebar-wrapper {
                            display: block !important;
                            width: 100% !important;
                            height: auto !important;
                            margin-top: 30px !important;
                            pointer-events: auto !important;
                        }
                        #reference-sidebar {
                            position: static !important;
                            max-height: none !important;
                            width: 100% !important;
                        }
                        .mw-indicators, #coordinates { right: 0 !important; }
                    }
                `;
                document.head.appendChild(style);

                return true;
            }

            const loadInterval = setInterval(() => {
                if (initSidebar()) clearInterval(loadInterval);
            }, 250);

            setTimeout(() => clearInterval(loadInterval), 10000);

        })();
    }
});