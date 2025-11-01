Feature: Playlist Curation
  As a music lover
  I want to curate custom playlists
  So that I can organize my music collection for different moods and occasions

  Background:
    Given the music library contains the following tracks:
      | track_id | title              | artist        | duration | phases         |
      | track-1  | Energy Boost       | DJ Alpha      | 180      | starter        |
      | track-2  | Rising Tension     | DJ Alpha      | 240      | buildup        |
      | track-3  | Maximum Impact     | Bass Masters  | 300      | peak           |
      | track-4  | Smooth Descent     | Chill Vibes   | 210      | release        |
      | track-5  | Special Moment     | Featured Artist| 270     | feature        |

  # ============================================================================
  # Basic Playlist Operations
  # ============================================================================

  Scenario: Create a new empty playlist
    Given I am viewing my music library
    When I create a new playlist named "Weekend Vibes"
    Then a playlist named "Weekend Vibes" should exist
    And the playlist should contain 0 tracks
    And the playlist total duration should be 0 seconds

  Scenario: Add a single track to a playlist
    Given a playlist named "Morning Energy" exists
    And the playlist is currently empty
    When I add track "Energy Boost" to the playlist
    Then the playlist should contain 1 track
    And the playlist should include track "Energy Boost"
    And the playlist total duration should be 180 seconds

  Scenario: Add multiple tracks to a playlist
    Given a playlist named "Peak Hour" exists
    When I add the following tracks to the playlist:
      | title          |
      | Energy Boost   |
      | Rising Tension |
      | Maximum Impact |
    Then the playlist should contain 3 tracks
    And the playlist total duration should be 720 seconds
    And the tracks should be in the order:
      | position | title          |
      | 1        | Energy Boost   |
      | 2        | Rising Tension |
      | 3        | Maximum Impact |

  Scenario: Remove a track from a playlist
    Given a playlist named "Mixed Set" exists
    And the playlist contains the following tracks:
      | title          |
      | Energy Boost   |
      | Rising Tension |
      | Maximum Impact |
    When I remove track "Rising Tension" from the playlist
    Then the playlist should contain 2 tracks
    And the playlist should not include track "Rising Tension"
    And the playlist total duration should be 480 seconds

  # ============================================================================
  # Invariant Preservation
  # ============================================================================

  Scenario: Prevent duplicate tracks in a playlist
    Given a playlist named "No Duplicates" exists
    And the playlist contains track "Energy Boost"
    When I attempt to add track "Energy Boost" to the playlist again
    Then the operation should fail with error "Track already in playlist"
    And the playlist should still contain 1 track
    And the playlist total duration should remain 180 seconds

  Scenario: Maintain duration consistency
    Given a playlist named "Duration Check" exists
    When I add track "Energy Boost" with duration 180 seconds
    And I add track "Maximum Impact" with duration 300 seconds
    Then the playlist total duration should equal the sum of track durations
    And the calculated duration should be 480 seconds

  # ============================================================================
  # Playlist Organization
  # ============================================================================

  Scenario: Reorder tracks in a playlist
    Given a playlist named "Perfect Order" exists
    And the playlist contains tracks in this order:
      | position | title          |
      | 1        | Maximum Impact |
      | 2        | Energy Boost   |
      | 3        | Rising Tension |
    When I move track "Energy Boost" to position 1
    Then the tracks should be in the order:
      | position | title          |
      | 1        | Energy Boost   |
      | 2        | Maximum Impact |
      | 3        | Rising Tension |

  Scenario: Filter playlist by phase
    Given a playlist named "Mixed Phases" exists
    And the playlist contains tracks:
      | title          | phases  |
      | Energy Boost   | starter |
      | Maximum Impact | peak    |
      | Smooth Descent | release |
    When I filter the playlist to show only "peak" phase tracks
    Then I should see 1 track
    And the visible track should be "Maximum Impact"

  # ============================================================================
  # Playlist Shuffling
  # ============================================================================

  Scenario: Shuffle playlist tracks
    Given a playlist named "Shuffle Test" exists
    And the playlist contains 5 tracks in a specific order
    When I shuffle the playlist
    Then the playlist should still contain 5 tracks
    And the track order should be different from the original
    And all original tracks should still be present
    And the playlist total duration should remain unchanged

  # ============================================================================
  # Edge Cases
  # ============================================================================

  Scenario: Create playlist with empty name
    Given I am viewing my music library
    When I attempt to create a playlist with an empty name
    Then the operation should fail with error "Playlist name cannot be empty"
    And no new playlist should be created

  Scenario: Add non-existent track to playlist
    Given a playlist named "Error Test" exists
    When I attempt to add track with ID "non-existent-track"
    Then the operation should fail with error "Track not found"
    And the playlist should remain unchanged

  Scenario: Remove non-existent track from playlist
    Given a playlist named "Error Test" exists
    And the playlist contains track "Energy Boost"
    When I attempt to remove track with ID "non-existent-track"
    Then the operation should fail with error "Track not in playlist"
    And the playlist should still contain 1 track

  # ============================================================================
  # Persistence and Retrieval
  # ============================================================================

  Scenario: Retrieve saved playlist
    Given I created a playlist named "Saved Playlist" yesterday
    And the playlist contains 3 tracks
    When I close and reopen the application
    And I navigate to "Saved Playlist"
    Then the playlist should contain 3 tracks
    And the playlist total duration should be correct
    And all track information should be preserved

  Scenario: Update playlist timestamp
    Given a playlist named "Timestamp Test" was created on "2025-01-01"
    When I add a track to the playlist on "2025-01-02"
    Then the playlist creation date should remain "2025-01-01"
    And the playlist updated date should be "2025-01-02"
    And the creation date should be before or equal to the updated date

  # ============================================================================
  # Phase-Based Curation
  # ============================================================================

  Scenario: Create playlist from specific phases
    Given I am viewing my music library
    When I create a new playlist named "Energy Journey"
    And I add all tracks with phase "starter"
    And I add all tracks with phase "buildup"
    And I add all tracks with phase "peak"
    Then the playlist should follow the phase progression
    And the playlist should create an energy curve

  Scenario: Validate phase tags on tracks
    Given a track named "New Track" without phase tags
    When I add the track to playlist "Phase Check"
    Then the track should be added successfully
    And the track should have an empty phases list
    And the playlist should handle tracks without phases correctly

  # ============================================================================
  # Future: Advanced Features (Not Yet Implemented)
  # ============================================================================

  @future
  Scenario: Generate smart playlist based on criteria
    Given I am viewing my music library
    When I create a smart playlist with criteria:
      | criterion      | value   |
      | minimum_duration | 240    |
      | phase          | peak    |
      | artist         | Bass Masters |
    Then the playlist should automatically include matching tracks
    And the playlist should update when new matching tracks are added

  @future
  Scenario: Export playlist to external format
    Given a playlist named "Export Test" with 5 tracks
    When I export the playlist to M3U format
    Then an M3U file should be created
    And the file should contain all track file paths
    And the file should be valid for external players

  @future
  Scenario: Share playlist with other users
    Given a playlist named "Shared Vibes" with 10 tracks
    When I generate a share link for the playlist
    Then other users should be able to import the playlist
    And the imported playlist should preserve track order and metadata
