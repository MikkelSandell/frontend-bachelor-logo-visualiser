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
