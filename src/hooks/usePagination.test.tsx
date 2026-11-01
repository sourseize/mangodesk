import { act, renderHook } from "@testing-library/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Pagination } from "../components/Pagination";
import { usePagination } from "./usePagination";

const numbers = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

describe("usePagination", () => {
  it("slices items per page and clamps navigation", () => {
    const { result } = renderHook(() => usePagination(numbers(45), 20));
    expect(result.current).toMatchObject({ page: 1, pageCount: 3, start: 1, end: 20, total: 45 });
    expect(result.current.pageItems).toEqual(numbers(20));

    act(() => result.current.setPage(3));
    expect(result.current).toMatchObject({ page: 3, start: 41, end: 45 });
    expect(result.current.pageItems).toEqual([41, 42, 43, 44, 45]);

    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(3);
    act(() => result.current.setPage(0));
    expect(result.current.page).toBe(1);
  });

  it("moves back when the list shrinks below the current page", () => {
    let items = numbers(45);
    const { result, rerender } = renderHook(() => usePagination(items, 20));
    act(() => result.current.setPage(3));

    items = numbers(5);
    rerender();
    expect(result.current).toMatchObject({ page: 1, pageCount: 1, pageItems: numbers(5) });
  });

  it("handles an empty list", () => {
    const { result } = renderHook(() => usePagination([], 20));
    expect(result.current).toMatchObject({ page: 1, pageCount: 1, start: 0, end: 0, total: 0, pageItems: [] });
  });
});

describe("Pagination", () => {
  function Harness({ count, compact = false }: { count: number; compact?: boolean }) {
    const pagination = usePagination(numbers(count), 10);
    return (
      <>
        <output>{pagination.pageItems.join(",")}</output>
        <Pagination pagination={pagination} label="things" compact={compact} />
      </>
    );
  }

  it("renders nothing for a single page", () => {
    render(<Harness count={10} />);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("navigates between pages", async () => {
    const user = userEvent.setup();
    render(<Harness count={25} />);

    expect(screen.getByRole("navigation", { name: "things pages" })).toHaveTextContent("1–10 of 25 things");
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("21–25 of 25 things")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("21,22,23,24,25");

    await user.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("11–20 of 25 things")).toBeInTheDocument();
  });

  it("uses a short summary in compact mode", () => {
    render(<Harness count={25} compact />);
    expect(screen.getByRole("navigation")).toHaveTextContent("1/3");
  });
});
