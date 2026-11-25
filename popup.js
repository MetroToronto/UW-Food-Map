// Shared popup builder for UW Food Services and Student Society markers.
// These are temporary example prices. Real food data can be connected later.
const SAMPLE_STORE_NAME = "Evergreen Cafe";
const SAMPLE_FOOD_PRICES = [
    { item: "Sandwich", price: "$6.50" },
    { item: "Coffee", price: "$2.25" },
    { item: "Pizza Slice", price: "$4.50" }
];

let popupSequence = 0;

// Use textContent instead of HTML strings to safely display GeoJSON properties.
function popupElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

/**
 * Make the content for one Leaflet marker popup.
 * Supports food services, Student Societies, colleges, and WUSA.
 */
function createFoodPopup(properties, locationType) {
    const building = properties.BuildingName || "Unknown building";
    const code = properties.BuildingCode || "";
    const buildingLabel = code ? `${building} (${code})` : building;

    let title;
    let subtitle;
    let storeName = SAMPLE_STORE_NAME;

    if (locationType === "studentSociety") {
        title = properties.CnDName || "Student Society Food Location";
        subtitle = [
            properties.StudentSocietyName || properties.StudentSociety || "Student Society",
            buildingLabel
        ].join(" · ");
    } else if (locationType === "college") {
        title = properties.CollegeName || building;
        subtitle = [code, "College Food Location"].filter(Boolean).join(" · ");
        // Use the supplied name rather than the temporary Evergreen Cafe name.
        storeName = properties.StoreName || SAMPLE_STORE_NAME;
    } else if (locationType === "wusa") {
        title = "WUSA";
        subtitle = buildingLabel;
    } else {
        title = building;
        subtitle = [code, "UW Food Services"].filter(Boolean).join(" · ");
    }

    const popupId = ++popupSequence;
    const root = popupElement("div", "food-popup");

    // Location header.
    const header = popupElement("div", "food-popup-header");
    header.append(
        popupElement("h2", "food-popup-title", title),
        popupElement("p", "food-popup-subtitle", subtitle)
    );
    root.appendChild(header);

    // Three tabs immediately under the location title.
    const tabs = popupElement("div", "food-popup-tabs");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Food location details");

    const sections = popupElement("div", "food-popup-sections");
    const definitions = [
        { key: "prices", label: "Price List" },
        { key: "comparison", label: "Price Comparison" },
        { key: "hours", label: "Hours" }
    ];
    const buttons = {};
    const panels = {};

    for (const tab of definitions) {
        const button = popupElement("button", "food-popup-tab", tab.label);
        button.type = "button";
        button.id = `popup-${popupId}-tab-${tab.key}`;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", `popup-${popupId}-panel-${tab.key}`);
        if (tab.key === "hours") button.classList.add("food-popup-tab-hours");

        const panel = popupElement("section", "food-popup-panel");
        panel.id = `popup-${popupId}-panel-${tab.key}`;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", button.id);

        tabs.appendChild(button);
        sections.appendChild(panel);
        buttons[tab.key] = button;
        panels[tab.key] = panel;
    }

    // Price List content, currently identical for every marker.
    panels.prices.appendChild(
        popupElement("h3", "food-popup-store", storeName)
    );
    panels.prices.appendChild(
        popupElement("h4", "food-popup-section-title", "Food prices")
    );

    const priceList = popupElement("div", "food-popup-price-list");
    for (const food of SAMPLE_FOOD_PRICES) {
        const row = popupElement("div", "food-popup-price-row");
        row.append(
            popupElement("span", "food-popup-item", food.item),
            popupElement("span", "food-popup-price", food.price)
        );
        priceList.appendChild(row);
    }
    panels.prices.appendChild(priceList);
    panels.prices.appendChild(
        popupElement(
            "p",
            "food-popup-note",
            "Illustrative prices only — not actual UW prices."
        )
    );

    // Comparison and Hours stay intentionally blank for now.
    panels.comparison.classList.add("food-popup-empty");
    panels.hours.classList.add("food-popup-empty");

    function showTab(tabKey) {
        for (const definition of definitions) {
            const active = definition.key === tabKey;
            buttons[definition.key].classList.toggle("is-active", active);
            buttons[definition.key].setAttribute("aria-selected", String(active));
            buttons[definition.key].tabIndex = active ? 0 : -1;
            panels[definition.key].hidden = !active;
        }
    }

    definitions.forEach((definition, index) => {
        const button = buttons[definition.key];
        button.addEventListener("click", (event) => {
            event.stopPropagation(); // Don't trigger other Leaflet map actions.
            showTab(definition.key);
        });

        // Arrow-key navigation for keyboard users.
        button.addEventListener("keydown", (event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const direction = event.key === "ArrowRight" ? 1 : -1;
            const next = definitions[(index + direction + definitions.length) % definitions.length];
            showTab(next.key);
            buttons[next.key].focus();
        });
    });

    root.append(tabs, sections);
    showTab("prices");
    return root;
}
