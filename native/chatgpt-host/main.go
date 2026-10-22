package main

import (
	"bufio"
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"os"
)

const maxMessageBytes = 4 << 20

func main() {
	host := newHost()
	reader := bufio.NewReader(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)
	for {
		var header [4]byte
		if _, err := io.ReadFull(reader, header[:]); err != nil {
			return
		}
		size := binary.LittleEndian.Uint32(header[:])
		if size == 0 || size > maxMessageBytes {
			return
		}
		payload := make([]byte, size)
		if _, err := io.ReadFull(reader, payload); err != nil {
			return
		}

		var request nativeRequest
		response := nativeResponse{Success: false, Error: "Invalid native message."}
		if err := json.Unmarshal(payload, &request); err == nil {
			response = host.handle(context.Background(), request)
		}
		encoded, err := json.Marshal(response)
		if err != nil || len(encoded) > 1<<20 {
			return
		}
		binary.LittleEndian.PutUint32(header[:], uint32(len(encoded)))
		if _, err = writer.Write(header[:]); err != nil {
			return
		}
		if _, err = writer.Write(encoded); err != nil || writer.Flush() != nil {
			return
		}
	}
}
