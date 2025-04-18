# frozen_string_literal: true

class ApplicationController < ActionController::API
  # Make sure ApiResponses is included if not done elsewhere
  include ApiResponses
  # Include the new pagination helper concern
  include PaginatedResponses
  include RecordResponses
  # Include Secured concern for authentication
  include Secured

  before_action :authorize
end
