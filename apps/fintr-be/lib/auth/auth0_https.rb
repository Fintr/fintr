# frozen_string_literal: true

require "net/http"
require "socket"

module Auth
  # Opens Auth0 HTTPS calls on IPv4 with short timeouts.
  #
  # Net::HTTP otherwise follows AAAA first. A blackholed IPv6 route sits on the
  # system connect timeout, which showed up as a ~40s wait on password login
  # for both the web app and the Capacitor shells.
  module Auth0Https
    OPEN_TIMEOUT_SECONDS = 5
    READ_TIMEOUT_SECONDS = 10

    module_function

    def open(uri)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = uri.scheme == "https"
      http.open_timeout = OPEN_TIMEOUT_SECONDS
      http.read_timeout = READ_TIMEOUT_SECONDS

      ipv4 = ipv4_address_for(uri.host)
      http.ipaddr = ipv4 if ipv4

      http
    end

    def ipv4_address_for(host)
      return nil if host.nil? || host.empty?

      Socket.getaddrinfo(
        host,
        nil,
        Socket::AF_INET,
        Socket::SOCK_STREAM
      ).dig(0, 3)
    rescue SocketError
      nil
    end
  end
end
