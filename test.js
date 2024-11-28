const myArray = [
    { id: 1, name: 'Alice', age: 25, role: 'Developer' },
    { id: 2, name: 'Bob', age: 30, role: 'Designer' },
    { id: 3, name: 'Charlie', age: 35, role: 'Product Manager' },
    { id: 4, name: 'Diana', age: 28, role: 'QA Engineer' },
    { id: 5, name: 'Eve', age: 32, role: 'DevOps' },
];

const myjson = []

for (const item of myArray) {
  myjson.push({
    name: item.name,
    role: item.role,
  });
}

for (const key in myArray[1]) {
  console.log('keys', myArray[1].key);
}

console.log(myjson);

