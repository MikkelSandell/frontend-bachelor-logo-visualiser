# Acceptance test documentation for Logo Visualizer.
# These scenarios are documented in Gherkin format and are verified by the existing
# Playwright end-to-end test suite. They are documentation only and do not add
# Cucumber automation.
#
# Mapping table
# | Acceptance Scenario | Requirement area | Verified by E2E test | Notes |
# |---|---|---|---|
# | Viewer can open a product with its print zone | Viewer product selection and zone visibility (V2, V3) | E2E-01 | Confirms an API-created product is visible and its print zone is shown in the viewer. |
# | Viewer can upload a valid PNG logo | Viewer logo upload (V1) | E2E-02 | Confirms a valid PNG can be uploaded and makes export actions available. |
# | Viewer can export the current design as PNG | Viewer PNG export (V8) | E2E-03 | Confirms a real backend PNG export succeeds and download starts. |
# | Viewer can export the current design as PDF | Viewer PDF export (V8) | E2E-04 | Confirms a real backend PDF export succeeds and download starts. |
# | Admin can create a product | Admin product creation (A1) | E2E-05 | Confirms a new product can be created through the admin UI. |
# | Admin can edit and save print-zone metadata | Admin print-zone editing and persistence (A2, A4, A8) | E2E-06 | Confirms zone values are updated and persisted after save. |
# | Viewer rejects an unsupported logo file format | Viewer upload validation (V1, NF) | E2E-07 | Confirms unsupported uploads are blocked or produce a visible error state. |
# | Viewer pre-loads a product from a URL parameter | Viewer URL parameter pre-load (V10) | E2E-08 | Confirms that opening the viewer with ?product=ID skips the product picker and opens the workspace directly. |
# | Viewer passes the selected print technique to the export request | Viewer print technique selection (V7) | E2E-09 | Confirms that the selected technique slug appears in the PNG export request body. |
# | Viewer displays a zone selector for a product with multiple print zones | Viewer multi-zone selection (V3) | E2E-10 | Confirms that ZoneSelector renders for multi-zone products and that activating zones updates the technique panel. |
# | Admin product list displays products with their setup status and supports search | Admin product list and search filter (A7) | E2E-11 | Confirms that a created product appears in the list with the correct status badge and that the name search filter works. |
# | Viewer color count selection is included in export payload | Viewer color-count export preview (V7) | E2E-12 | Confirms the selected color count is sent in the PNG export payload. |
# | Viewer exports both front and back sides in a multi-zone PDF | Viewer multi-side PDF export | E2E-13 | Confirms a product with Front and Back zones produces pages for both zones in PDF export. |

Feature: Logo Visualizer acceptance scenarios

  Scenario: Viewer can open a product with its print zone
    Given a product exists with at least one print zone
    When the user opens the viewer and selects that product
    Then the product should be shown in the viewer
    And the print zone should be visible to the user

  Scenario: Viewer can upload a valid PNG logo
    Given a product with a print zone is open in the viewer
    When the user uploads a valid PNG logo
    Then the viewer should confirm that the logo was uploaded
    And export actions should be available for the current design

  Scenario: Viewer can export the current design as PNG
    Given a product with a print zone is open in the viewer
    And a valid logo has been uploaded and assigned
    When the user chooses to download the design as PNG
    Then the PNG export should be generated successfully
    And the PNG download should start

  Scenario: Viewer can export the current design as PDF
    Given a product with a print zone is open in the viewer
    And a valid logo has been uploaded and assigned
    When the user chooses to download the design as PDF
    Then the PDF export should be generated successfully
    And the PDF download should start

  Scenario: Admin can create a product
    Given the admin user is on the product creation page
    When the admin enters valid product details and uploads a product image
    And the admin submits the form
    Then the product should be created successfully
    And the admin should be taken to the new product page

  Scenario: Admin can edit and save print-zone metadata
    Given a product already exists with a print zone
    And the admin opens that product in the editor
    When the admin edits the print-zone name, position, and size
    And the admin saves the zone and the product changes
    Then the updated print-zone values should be stored successfully

  Scenario: Viewer rejects an unsupported logo file format
    Given a product with a print zone is open in the viewer
    When the user tries to upload an unsupported logo file format
    Then the upload should be rejected
    And the design should not become exportable based on that invalid file

  Scenario: Viewer pre-loads a product when its ID is passed as a URL parameter
    Given a product with a print zone exists
    When the user opens the viewer with the product ID supplied as a URL parameter
    Then the product workspace should open directly without the user selecting a product
    And the product picker should not be visible
    And the export buttons should be disabled until a logo is uploaded

  Scenario: Viewer passes the selected print technique to the export request
    Given a product with a print zone that allows multiple techniques is open in the viewer
    And a valid logo has been uploaded and assigned to the zone
    When the user selects a specific print technique from the technique panel
    And the user downloads the design as PNG
    Then the export request should contain the slug of the selected technique

  Scenario: Viewer displays a zone selector for a product with multiple print zones
    Given a product with two print zones exists
    When the user opens the viewer and selects that product
    Then the zone selector should be visible with all print zones listed
    And activating both zones should make the technique panel reflect the currently focused zone

  Scenario: Viewer can select a color count and include it in export payload
    Given a product with a print zone is open in the viewer
    And a valid logo has been uploaded and assigned
    When the user selects a specific color count for the logo
    And the user downloads the design as PNG
    Then the export payload should contain the selected colorCount

  Scenario: Viewer exports both front and back sides in a multi-zone PDF
    Given a product with Front and Back print zones exists
    And the user has uploaded and assigned a logo to both zones
    When the user downloads the design as PDF
    Then the PDF export should contain at least one page for the front zone
    And the PDF export should contain at least one page for the back zone

  Scenario: Admin product list displays products with their setup status and supports name search
    Given a fully configured product with at least one print zone exists
    When the admin navigates to the product list
    Then the product should appear in the list with a fully configured status badge
    And the zone count should match the number of print zones on the product
    When the admin searches for the product by name
    Then only matching products should be visible in the list
    When the admin searches for a term that matches no products
    Then an empty-state message should be displayed
