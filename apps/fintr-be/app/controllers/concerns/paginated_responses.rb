# frozen_string_literal: true

module PaginatedResponses
  extend ActiveSupport::Concern
  # Ensure ApiResponses methods are available if not included globally
  include ApiResponses

  private

  def render_paginated(collection, serializer:, key: nil)
    # Determine the key for the data array, now inferring from the collection
    data_key = key || infer_data_key_from_collection(collection)

    # Serialize the data using the serializer
    serialized_data = serializer.render_as_hash(collection)

    # Extract pagination metadata
    pagination_meta = {
      current_page: collection.current_page,
      total_pages: collection.total_pages,
      total_count: collection.total_count
    }

    # Construct the final response data
    response_data = {
      data_key => serialized_data,
      pagination: pagination_meta
    }

    # Render using the standard success method
    render_success(data: response_data)
  end

  def render_paginated_with_totals(collection, serializer:, key:, totals:)
    data_key = key || :data

    serialized_data = serializer.render_as_hash(collection)

    pagination_meta = {
      current_page: collection.current_page,
      total_pages: collection.total_pages,
      total_count: collection.total_count
    }

    response_data = {
      data_key => serialized_data,
      pagination: pagination_meta,
      totals: totals
    }

    render_success(data: response_data)
  end

  # Updated helper to infer from the collection's items
  def infer_data_key_from_collection(collection)
    # Handle empty collection: return a default key
    return :data if collection.empty?

    # Get the class of the first item
    item_class = collection.first.class

    item_class.name
              .demodulize # Get class name without namespace (e.g., "Transaction")
              .underscore # Convert to snake_case (e.g., "transaction")
              .pluralize  # Make it plural (e.g., "transactions")
              .to_sym     # Convert to symbol (e.g., :transactions)
  end
end
