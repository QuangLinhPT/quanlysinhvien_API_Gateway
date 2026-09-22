# React + Vite

Mẫu dự án này cung cấp cấu hình tối thiểu để khởi chạy React với Vite, hỗ trợ HMR (Hot Module Replacement) và một số quy tắc linter (Oxlint).

Hiện tại, có 2 plugin chính thức khả dụng:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) sử dụng [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) sử dụng [SWC](https://swc.rs/)

## React Compiler

React Compiler chưa được bật mặc định trong mẫu này do ảnh hưởng tới hiệu năng dev & build. Để thêm vào, vui lòng xem [tài liệu hướng dẫn tại đây](https://react.dev/learn/react-compiler/installation).

## Mở rộng cấu hình Oxlint

Nếu bạn đang phát triển ứng dụng production, chúng tôi khuyên bạn nên sử dụng TypeScript cùng với các quy tắc kiểm tra kiểu dữ liệu (type-aware lint rules). Tham khảo [mẫu TS](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) để biết thêm thông tin về cách tích hợp TypeScript và các quy tắc Oxlint liên quan đến TypeScript trong dự án của bạn.
