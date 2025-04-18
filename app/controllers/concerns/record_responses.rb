module RecordResponses
  extend ActiveSupport::Concern
  # --- For Single Records ---
  def render_single(record, serializer:, key: nil)
    # Determine the key for the single record
    data_key = key || infer_data_key_from_record(record)

    # Serialize the single record
    serialized_data = serializer.render_as_hash(record)

    # Construct the final response data (no pagination)
    response_data = {
      data_key => serialized_data
    }

    render_success(data: response_data)
  end

  # Helper to infer the data key from a single record's class name
  def infer_data_key_from_record(record)
    # Handle nil record case gracefully, though usually should have a record
    return :data if record.nil?

    record.class.name
          .demodulize # Get class name without namespace (e.g., "Transaction")
          .underscore # Convert to snake_case (e.g., "transaction")
          .to_sym     # Convert to symbol (e.g., :transaction)
  end
end
